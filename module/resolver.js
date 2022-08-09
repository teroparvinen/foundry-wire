import { DamageCard } from "./cards/damage-card.js";
import { ItemCard } from "./cards/item-card.js";
import { DamageParts } from "./game/damage-parts.js";
import { hasApplicationsOfType, hasConcentration, hasDamageOfType, hasDuration, hasUnavoidableDamageOfType, hasUnavoidableEffectsOfType, isAttack, isInstantaneous, isSelfTarget, isTokenTargetable, targetsSingleToken } from "./item-properties.js";
import { copyConditions, copyEffectChanges, copyEffectDuration, effectDurationFromItemDuration, getActorToken, getAttackRollResultType, getSpeaker, isCasterDependentEffect, isInCombat, localizedWarning } from "./utils.js";

export class Resolver {
    static check(item) {
        if (isAttack(item) && !targetsSingleToken(item)) {
            return localizedWarning("wire.warn.attack-must-have-single-target");
        } else if (isAttack(item) && game.user.targets.size != 1) {
            return localizedWarning("wire.warn.select-single-target-for-attack");
        } else if (item.hasSave && !item.hasAreaTarget && game.user.targets.size == 0) {
            return localizedWarning("wire.warn.select-targets-for-effect");
        }

        return true;  
    }

    constructor(activation) {
        this.activation = activation;

        const message = this.activation.message;
        if (!('stepQueueNumber' in message)) { setProperty(message, "stepQueueNumber", 0); }
        if (!('stepLockCount' in message)) { setProperty(message, "stepLockCount", 0); }
        if (!('stepQueue' in message)) { setProperty(message, "stepQueue", []); }
    }

    async start() {
        const item = this.activation.item;

        if (hasDuration(item)) {
            if (hasConcentration(item)) {
                await this.applyConcentration();
            } else if (item.hasAreaTarget) {
                await this.applyDurationEffect();
            }
        }

        if (isTokenTargetable(item)) {
            if (isAttack(item)) {
                await this.activation.applyState("waiting-for-attack");
                this.step();
            } else { // TODO: Branch here for spells with non-primary effects
                await this.processImmediateNonAttack();
            }
        } else if (item.hasAreaTarget) {
            if (hasApplicationsOfType(item, "immediate")) {
                await this.activation.applyState("waiting-for-area-target");
            } else {
                await this.activation.applyState("register-triggers");
                this.step();
            }
        }

    }

    async processImmediateNonAttack() {
        const item = this.activation.item;

        if (item.hasSave) {
            await this.activation.applyState("waiting-for-saves");
            if (game.user.isGM && this.activation.message.user === game.user && this.activation.pcTargets.length) {
                const playerMessageData = {
                    content: await ItemCard.renderHtml(item, this.activation, true),
                    flags: {
                        wire: {
                            masterMessageUuid: this.activation.message.uuid,
                            originatorUserId: game.user.id,
                            isPlayerView: true
                        }
                    },
                    user: game.user.id
                };
                const playerMessage = await ChatMessage.create(playerMessageData);
                this.activation.message.setFlag("wire", "playerMessageUuid", playerMessage.uuid);
            }
        } else {
            if (isSelfTarget(item) || this.activation.allTargets.length == 0) {
                await this.activation.applyEffectiveTargets([item.actor]);
            } else {
                await this.activation.applyEffectiveTargets(this.activation.allTargets.map(t => t.actor));
            }
            if (hasDamageOfType(item, "immediate")) {
                await this.activation.applyState("waiting-for-save-damage-roll");
            } else {
                await this.activation.applyState("applying-target-effects");
                await this.step();
            }
        }
    }

    get message() { return this.activation.message; }

    // Implement a primitive semaphore to avoid state machine re-entrancy issues
    async step(queueNumber = null) {
        const msg = this.message;
        const n = queueNumber || ++this.message.stepQueueNumber;
        if (n === msg.stepQueueNumber || msg.stepLockCount === 0) {
            msg.stepLockCount++;
            await this._step(n);
            msg.stepLockCount--;

            if (msg.stepLockCount == 0 && msg.stepQueue.length > 0) {
                msg.stepQueue.pop()();
            }
        } else {
            console.log("NEED TO WAIT");
            await new Promise((resolve, reject) => {
                msg.stepQueue.push(() => { resolve(); });
            });
            await this.step(n);
        }
    }

    async _step(n) {
        const item = this.activation.item;

        const isGM = game.user.isGM;
        const isObservingGM = isGM && this.activation.isObserver;

        if (!isObservingGM && this.activation.state === "waiting-for-attack") {
            const roll = await item.rollAttack({ chatMessage: false, fastForward: true });
            await game.dice3d?.showForRoll(roll, game.user, !game.user.isGM);
            await this.activation.applyAttackRoll(roll);
            await this.activation.applyState("waiting-for-attack-result");
        } else if (isGM && this.activation.state === "waiting-for-attack-result") {
            if (this.activation.attackResult == "hit") {
                await this.activation.applyEffectiveTargets([this.activation.singleTarget.actor]);
                if (hasDamageOfType(item, "immediate")) {
                    await this.activation.applyState("waiting-for-attack-damage-roll");
                } else {
                    await this.activation.applyState("applying-target-effects");
                    await this.step(n);
                }
            } else if (this.activation.attackResult == "miss") {
                if (hasUnavoidableDamageOfType(item, "immediate")) {
                    await this.activation.applyState("waiting-for-attack-damage-roll");
                } else if (hasUnavoidableEffectsOfType(item, "immediate")) {
                    await this.activation.applyState("applying-target-effects");
                    await this.step(n);
                } else {
                    await this.activation.applyState("done");
                }
            }
        } else if (!isObservingGM && this.activation.state === "area-target-placed") {
            await this.activation.applyState("waiting-for-target-confirmation");
        } else if (!isObservingGM && this.activation.state === "targets-confirmed") {
            await this.activation.assignTargets([...game.user.targets].map(t => t.actor));
            if (isInstantaneous(item)) {
                await this.activation.template?.delete();
            }
            await this.processImmediateNonAttack();
        } else if (!isObservingGM && this.activation.state === "rolling-attack-damage") {
            await this.activation.applyState("waiting-for-attack-damage");

            const isCritical = getAttackRollResultType(this.activation.attackRoll) == "critical";
            const onlyUnavoidable = this.activation.effectiveTargets.length == 0;
            const damageParts = await DamageParts.roll(item, "immediate", onlyUnavoidable, { isCritical });
            await damageParts.roll3dDice();

            await this.activation.applyDamageRollParts(damageParts);
            await this.activation.applyState("attack-damage-rolled");
            await this.step(n);
        } else if (isGM && this.activation.state === "attack-damage-rolled") {
            await this.applyDamage();
            await this.activation.applyState("applying-target-effects");
            await this.step(n);
        } else if (isGM && this.activation.state === "waiting-for-saves") {
            if (this.activation.saveResults?.length === this.activation.allTargets.length) {
                await this.activation.applyState("saves-complete");
                await this.step(n);
            }
        } else if (isGM && this.activation.state === "saves-complete") {
            const dc = item.data.data.save.dc;
            const failedActors = this.activation.saveResults.filter(r => r.roll.total < dc).map(r => r.actor);
            await this.activation.applyEffectiveTargets(failedActors);
            if ((failedActors.length && hasDamageOfType(item, "immediate")) || hasUnavoidableDamageOfType(item, "immediate")) {
                await this.activation.applyState("waiting-for-save-damage-roll");
            } else {
                await this.activation.applyState("applying-target-effects");
                await this.step(n);
            }
        } else if (!isObservingGM && this.activation.state === "rolling-save-damage") {
            await this.activation.applyState("waiting-for-save-damage");

            const damageParts = await DamageParts.roll(item, "immediate");
            await damageParts.roll3dDice();

            await this.activation.applyDamageRollParts(damageParts);
            await this.activation.applyState("save-damage-rolled");
            await this.step(n);
        } else if (isGM && this.activation.state === "save-damage-rolled") {
            await this.applyDamage();
            await this.activation.applyState("applying-target-effects");
            await this.step(n);
        } else if (isGM && this.activation.state === "applying-target-effects") {
            await this.applyTargetEffects("immediate");
            await this.activation.applyState("register-triggers");
            await this.step(n);
        } else if (isGM && this.activation.state === "register-triggers") {
            await this.registerTriggers();
            await this.activation.applyState("done");
        }
    }

    async applyDamage() {
        const item = this.activation.item;
        const speaker = item.actor;
        const damageParts = this.activation.damageParts;
        const targets = this.activation.allTargets;
        const effectiveTargets = this.activation.effectiveTargets; // Attack hit or save failed

        const targetDamage = targets
            .map(target => {
                return {
                    actor: target.actor,
                    token: target.token,
                    points: damageParts.appliedToActor(target.actor, effectiveTargets.map(t => t.actor).includes(target.actor))
                };
            });
        const actualDamage = targetDamage.filter(t => t.points.damage > 0 || t.points.healing > 0 || t.points.temphp > 0);

        const pcDamage = actualDamage.filter(t => t.actor.hasPlayerOwner);
        const npcDamage = actualDamage.filter(t => !t.actor.hasPlayerOwner);
    
        if (pcDamage.length) {
            const pcDamageCard = new DamageCard(true, speaker, pcDamage);
            await pcDamageCard.make();
        }
        if (npcDamage.length) {
            const npcDamageCard = new DamageCard(false, speaker, npcDamage);
            await npcDamageCard.make();
        }
        if (!pcDamage.length && !npcDamage.length) {
            const noDamageCard = new DamageCard(false, speaker, []);
            await noDamageCard.make();
        }
    }

    async applyConcentration() {
        const item = this.activation.item;
        const actor = item.actor;

        let effect;

        const ceApi = game.dfreds?.effectInterface;
        if (ceApi) {
            if (ceApi.hasEffectApplied("Concentrating"), actor.uuid) {
                ceApi.removeEffect({
                    effectName: "Concentrating",
                    uuid: actor.uuid
                });
            }

            const ceEffect = ceApi.findEffectByName("Concentrating").convertToActiveEffectData({ origin: item.uuid, overlay: false });
            const effectData = duplicate(ceEffect);
            effectData.duration = effectDurationFromItemDuration(item.data.data.duration, isInCombat(actor));
            effectData.flags = foundry.utils.mergeObject(effectData.flags, {
                wire: {
                    activationMessageId: this.activation.message.id,
                    isMasterEffect: true
                }
            });

            const effects = await actor.createEmbeddedDocuments("ActiveEffect", [effectData]);
            effect = effects[0];
        } else {
            const concentratingLabel = game.i18n.localize("wire.concentrating");

            await item.actor.effects.find(e => e.data.label === concentratingLabel)?.delete();
    
            const effectData = {
                changes: [],
                origin: item.uuid,
                disabled: false,
                icon: "modules/wire/icons/concentrating.svg",
                label: concentratingLabel,
                duration: effectDurationFromItemDuration(item.data.data.duration, isInCombat(actor)),
                flags: {
                    wire: {
                        activationMessageId: this.activation.message.id,
                        isMasterEffect: true
                    }
                }
            };
            const effects = await actor.createEmbeddedDocuments("ActiveEffect", [effectData]);
            effect = effects[0];
        }

        if (effect) {
            await this.activation.assignMasterEffect(effect);
        }
    }

    async applyDurationEffect() {
        const item = this.activation.item;
        const actor = item.actor;

        const effectData = {
            changes: [],
            origin: item.uuid,
            disabled: false,
            icon: item.img,
            label: item.name,
            duration: effectDurationFromItemDuration(item.data.data.duration, isInCombat(actor)),
            flags: {
                wire: {
                    activationMessageId: this.activation.message.id,
                    isMasterEffect: true
                }
            }
        };
        const effects = await actor.createEmbeddedDocuments("ActiveEffect", [effectData]);
        const effect = effects[0];

        if (effect) {
            await this.activation.assignMasterEffect(effect);
        }
    }

    async applyTargetEffects(applicationType) {
        const item = this.activation.item;
        const actor = item.actor;
        const allTargets = this.activation.allTargets;
        const effectiveTargets = this.activation.effectiveTargets;
        const masterEffect = this.activation.masterEffect;

        const staticDuration = effectDurationFromItemDuration(item.data.data.duration, isInCombat(actor));
        const appliedDuration = masterEffect ? copyEffectDuration(masterEffect) : staticDuration;

        const effects = item.effects.filter(e => !e.isSuppressed && !e.isTemporary && !e.data.transfer && (e.getFlag("wire", "applicationType") || "immediate") === applicationType);
        const allTargetsEffects = effects.filter(e => e.getFlag("wire", "applyOnSaveOrMiss"));
        const effectiveTargetsEffects = effects.filter(e => !e.getFlag("wire", "applyOnSaveOrMiss"));

        const makeEffectData = (effect) => {
            return foundry.utils.mergeObject(
                {
                    changes: copyEffectChanges(effect),
                    origin: item.uuid,
                    disabled: false,
                    icon: effect.data.icon,
                    label: effect.data.label,
                    duration: appliedDuration,
                    flags: {
                        wire: {
                            activationMessageId: this.activation.message.id,
                            castingActorUuid: actor.uuid,
                            conditions: copyConditions(effect)
                        }
                    }
                },
                masterEffect ? {
                    flags: {
                        wire: {
                            masterEffectUuid: masterEffect.uuid
                        }
                    }
                } : {}
            );
        };

        const allTargetsEffectData = allTargetsEffects.map(effect => makeEffectData(effect));
        const effectiveTargetsEffectData = effectiveTargetsEffects.map(effect => makeEffectData(effect));
   
        let createdEffects = [];

        for (let target of allTargets) {
            const targetEffects = await target.actor.createEmbeddedDocuments("ActiveEffect", allTargetsEffectData);
            createdEffects = [...createdEffects, ...targetEffects];
        }
        for (let target of effectiveTargets) {
            const targetEffects = await target.actor.createEmbeddedDocuments("ActiveEffect", effectiveTargetsEffectData);
            createdEffects = [...createdEffects, ...targetEffects];
        }

        await masterEffect?.setFlag("wire", "childEffectUuids", createdEffects.map(e => e.uuid));

        const casterDependentEffectUuids = createdEffects.filter(e => isCasterDependentEffect(e)).map(e => e.uuid);
        await actor.setFlag("wire", "turnUpdatedEffectUuids", [...(actor.data.flags.wire?.turnUpdatedEffectUuids || []), ...casterDependentEffectUuids]);
    }

    async registerTriggers() {
        await this.activation.masterEffect?.setFlag("wire", "conditions", this.activation.item.getFlag("wire", "conditions"));
    }

}