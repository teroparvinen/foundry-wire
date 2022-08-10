import { DamageCard } from "./cards/damage-card.js";
import { ItemCard } from "./cards/item-card.js";
import { DamageParts } from "./game/damage-parts.js";
import { hasDamageOfType, hasUnavoidableDamageOfType, hasUnavoidableEffectsOfType, isAttack, isInstantaneous, targetsSingleToken } from "./item-properties.js";
import { copyConditions, copyEffectChanges, copyEffectDuration, effectDurationFromItemDuration, getAttackRollResultType, isCasterDependentEffect, isInCombat, localizedWarning } from "./utils.js";

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

    get message() { return this.activation.message; }

    async start() {
        await this.activation.applyState("idle");
        await this.step();
    }

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
            await new Promise((resolve, reject) => {
                msg.stepQueue.push(() => { resolve(); });
            });
            await this.step(n);
        }
    }

    knownStates = [
        "applyConcentration", 
        "applyDamage", 
        "applyDefaultTargets", 
        "applyDurationEffect", 
        "applyEffects", 
        "idle", 
        "performAttackDamageRoll",
        "performAttackRoll", 
        "performSaveDamageRoll", 
        "performSavingThrow", 
        "rolling-attack-damage", 
        "rolling-save-damage", 
        "targets-confirmed",
        "waiting-for-attack-damage",
        "waiting-for-attack-damage-roll",
        "waiting-for-attack-result",
        "waiting-for-saves",
        "waiting-for-save-damage",
        "waiting-for-save-damage-roll"
    ];

    async _step(n) {
        const item = this.activation.item;
        const applicationType = this.activation.applicationType;

        const isGM = game.user.isGM;
        const isObservingGM = isGM && this.activation.isObserver;
        const isAuthor = this.activation.message.isAuthor;
        const isOriginator = this.activation.message.data.flags.wire?.originatorUserId === game.user.id;

        if (isAuthor && this.activation.state === "applyConcentration") {
            await this._applyConcentration();
            await this.activation.applyState("idle");
            await this.step(n);

        } else if (isAuthor && this.activation.state === "applyDurationEffect") {
            await this._applyDurationEffect();
            await this.activation.applyState("idle");
            await this.step(n);

        } else if (isAuthor && this.activation.state === "applyDefaultTargets") {
            await this.activation.assignDefaultTargets();
            await this.activation.applyState("idle");
            await this.step(n);

        } else if (isAuthor && this.activation.state === "applySelectedTargets") {
            await this.activation.assignTargets([...game.user.targets].map(t => t.actor));
            await this.activation.applyState("idle");
            await this.step(n);

        } else if (isOriginator && this.activation.state === "performAttackRoll") {
            const roll = await item.rollAttack({ chatMessage: false, fastForward: true });
            await game.dice3d?.showForRoll(roll, game.user, !game.user.isGM);
            await this.activation.applyAttackRoll(roll);
            await this.activation.applyState("waiting-for-attack-result");
        } else if (isGM && this.activation.state === "waiting-for-attack-result") {
            if (this.activation.attackResult == "hit") {
                await this.activation.applyEffectiveTargets([this.activation.singleTarget.actor]);
                await this.activation.applyState("idle");
                await this.step(n);
            } else if (this.activation.attackResult == "miss") {
                await this.activation.applyState("idle");
                await this.step(n);
            }

        } else if (isAuthor && this.activation.state === "targets-confirmed") {
            await this.activation.assignTargets([...game.user.targets].map(t => t.actor));
            if (isInstantaneous(item)) {
                await this.activation.template?.delete();
            }
            await this.activation.applyState("idle");
            await this.step(n);

        } else if (isAuthor && this.activation.state === "performAttackDamageRoll") {
            if ((this.activation.effectiveTargets.length && hasDamageOfType(item, applicationType)) || hasUnavoidableDamageOfType(item, applicationType)) {
                await this.activation.applyState("waiting-for-attack-damage-roll");
                this.step(n);
            } else {
                await this.activation.applyState("idle");
                await this.step(n);
            }
        } else if (isOriginator && this.activation.state === "rolling-attack-damage") {
            await this.activation.applyState("waiting-for-attack-damage");

            const isCritical = getAttackRollResultType(this.activation.attackRoll) == "critical";
            const onlyUnavoidable = this.activation.effectiveTargets.length == 0;
            const damageParts = await DamageParts.roll(item, applicationType, onlyUnavoidable, { isCritical });
            await damageParts.roll3dDice();

            await this.activation.applyDamageRollParts(damageParts);
            await this.activation.applyState("idle");
            await this.step(n);

        } else if (isAuthor && this.activation.state === "performSaveDamageRoll") {
            if ((this.activation.effectiveTargets.length && hasDamageOfType(item, applicationType)) || hasUnavoidableDamageOfType(item, applicationType)) {
                await this.activation.applyState("waiting-for-save-damage-roll");
            } else {
                await this.activation.applyState("idle");
                await this.step(n);
            }
        } else if (isOriginator && this.activation.state === "rolling-save-damage") {
            await this.activation.applyState("waiting-for-save-damage");

            const damageParts = await DamageParts.roll(item, applicationType);
            await damageParts.roll3dDice();

            await this.activation.applyDamageRollParts(damageParts);
            await this.activation.applyState("idle");
            await this.step(n);

        } else if (isGM && this.activation.state === "performSavingThrow") {
            if (game.user.isGM && this.activation.message.user === game.user && this.activation.pcTargets.length) {
                this.activation.createPlayerMessage();
            }
            await this.activation.applyState("waiting-for-saves");
        } else if (isGM && this.activation.state === "waiting-for-saves") {
            if (this.activation.saveResults?.length === this.activation.allTargets.length) {
                const dc = item.data.data.save.dc;
                const failedActors = this.activation.saveResults.filter(r => r.roll.total < dc).map(r => r.actor);
                await this.activation.applyEffectiveTargets(failedActors);
                await this.activation.applyState("idle");
                await this.step(n);
            }

        } else if (isGM && this.activation.state === "applyDamage") {
            await this._applyDamage();
            await this.activation.applyState("idle");
            await this.step(n);

        } else if (isGM && this.activation.state === "applyEffects") {
            await this._applyTargetEffects(applicationType);
            await this.activation.applyState("idle");
            await this.step(n);

        } else if (isGM && this.activation.state === "endEffect") {
            await this._endEffect(true);
            await this.activation.applyState("idle");
            await this.step(n);

        } else if (isGM && this.activation.state === "endEffectOnSave") {
            await this._endEffect();
            await this.activation.applyState("idle");
            await this.step(n);

        } else if (isAuthor && this.activation.state === "idle") {
            const flow = this.activation.flow;
            const next = flow.shift();
            await this.activation.updateFlow(flow);
            await this.activation.applyState(next);
            this.step(n);
        } else if (this.activation.state && !this.knownStates.includes(this.activation.state)) {
            console.log("UNKNOWN STATE", this.activation.state, ". Maybe run a macro?");
        }
    }

    async _applyDamage() {
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

    async _applyConcentration() {
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
            await effect.setFlag("wire", "conditions", this.activation.item.getFlag("wire", "conditions"));
            await this.activation.assignMasterEffect(effect);
        }
    }

    async _applyDurationEffect() {
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
            await effect.setFlag("wire", "conditions", this.activation.item.getFlag("wire", "conditions"));
            await this.activation.assignMasterEffect(effect);
        }
    }

    async _applyTargetEffects(applicationType) {
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

        const applyEffect = async (target, data) => {
            const existingEffects = target.actor.effects.filter(e => e.data.origin === item.uuid);
            if (existingEffects.length) {
                await target.actor.deleteEmbeddedDocuments("ActiveEffect", existingEffects.map(e => e.id));
            }
            const targetEffects = await target.actor.createEmbeddedDocuments("ActiveEffect", data);
            createdEffects = [...createdEffects, ...targetEffects];
        }

        for (let effect of createdEffects) {
            await effect.setFlag("wire", "originatorUserId", this.activation.message.data.flags.wire?.originatorUserId);
        }

        for (let target of allTargets) {
            await applyEffect(target, allTargetsEffectData);
        }
        for (let target of effectiveTargets) {
            await applyEffect(target, effectiveTargetsEffectData);
        }

        await masterEffect?.setFlag("wire", "childEffectUuids", createdEffects.map(e => e.uuid));

        const casterDependentEffectUuids = createdEffects.filter(e => isCasterDependentEffect(e)).map(e => e.uuid);
        await actor.setFlag("wire", "turnUpdatedEffectUuids", [...(actor.data.flags.wire?.turnUpdatedEffectUuids || []), ...casterDependentEffectUuids]);
    }

    async _endEffect(force = false) {
        const effect = this.activation.sourceEffect;
        if (effect) {
            if (force || !this.activation.effectiveTargets.length) {
                await effect.delete();
            }
        }
    }

}