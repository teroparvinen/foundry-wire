import { DamageCard } from "./cards/damage-card.js";
import { applyTargetEffects } from "./game/active-effects.js";
import { DamageParts } from "./game/damage-parts.js";
import { getAttackOptions } from "./game/effect-flags.js";
import { hasApplicationsOfType, hasDamageOfType, hasOnlyUnavoidableEffectsOfType, hasUnavoidableDamageOfType, isInstantaneous } from "./item-properties.js";
import { makeUpdater } from "./updater-utility.js";
import { checkEffectDurationOverride, copyConditions, copyEffectChanges, copyEffectDuration, effectDurationFromItemDuration, fromUuid, getActorToken, getAttackRollResultType, isCasterDependentEffect, isInCombat, localizedWarning, playAutoAnimation, runAndAwait, triggerConditions } from "./utils.js";

export class Resolver {
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
        "action-trigger-activated",
        "applyConcentration", 
        "applyDamage", 
        "applyDefaultTargets",
        "applyDefaultTargetsAsEffective",
        "applyDurationEffect", 
        "applyEffects",
        "attackCompleted",
        "confirmTargets",
        "idle", 
        "performAttackDamageRoll",
        "performAttackRoll", 
        "performSaveDamageRoll", 
        "performSavingThrow", 
        "rolling-attack-damage", 
        "rolling-save-damage", 
        "targets-confirmed",
        "triggerAction",
        "waiting-for-action-trigger",
        "waiting-for-attack-damage",
        "waiting-for-attack-damage-roll",
        "waiting-for-attack-result",
        "waiting-for-saves",
        "waiting-for-save-damage",
        "waiting-for-save-damage-roll",
        "waiting-for-target-confirmation"
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
        } else if (isAuthor && this.activation.state === "applyDefaultTargetsAsEffective") {
            await this.activation.assignDefaultTargets(true);
            playAutoAnimation(getActorToken(item.actor), this.activation.effectiveTargets.map(t => t.token), item);
            await this.activation.applyState("idle");
            await this.step(n);

        } else if (isAuthor && this.activation.state === "applySelectedTargets") {
            await this.activation.assignTargets([...game.user.targets].map(t => t.actor));
            await this.activation.applyState("idle");
            await this.step(n);

        } else if (isAuthor && this.activation.state === "applyTargetFromCondition") {
            const conditionDetails = this.activation.condition.details;
            const targetActor = fromUuid(conditionDetails.attackTargetUuid) || fromUuid(conditionDetails.attackerUuid);
            const targetActors = targetActor ? [targetActor] : [];
            await this.activation.assignTargets(targetActors);
            await this.activation.applyState("idle");
            await this.step(n);
        } else if (isAuthor && this.activation.state === "applyTargetFromConditionAsEffective") {
            const conditionDetails = this.activation.condition.details;
            const targetActor = fromUuid(conditionDetails.attackTargetUuid) || fromUuid(conditionDetails.attackerUuid);
            const targetActors = targetActor ? [targetActor] : [];
            await this.activation.assignTargets(targetActors);
            await this.activation.applyEffectiveTargets(targetActors);
            await this.activation.applyState("idle");
            await this.step(n);

        } else if (isOriginator && this.activation.state === "performAttackRoll") {
            if (!this.activation.singleTarget) {
                localizedWarning("wire.warn.resolve-performAttackRoll-noTarget");
            }
            const options = getAttackOptions(this.activation);
            playAutoAnimation(getActorToken(item.actor), [this.activation.singleTarget.token], item);
            const roll = await item.rollAttack(foundry.utils.mergeObject({ chatMessage: false, fastForward: true }, options));
            await game.dice3d?.showForRoll(roll, game.user, !game.user.isGM);
            await this.activation.applyAttackTarget(this.activation.singleTarget.actor);
            await this.activation.applyAttackRoll(roll);
            await this.activation.registerAttackOptions(options);
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

        } else if (isAuthor && this.activation.state === "confirmTargets") {
            if (hasApplicationsOfType(item, this.activation.applicationType, this.activation.variant)) {
                await this.activation.applyState("waiting-for-target-confirmation");
            } else {
                await this.activation.applyState("targets-confirmed");
                await this.step(n);
            }
        } else if (isOriginator && this.activation.state === "targets-confirmed") {
            if (game.user.targets.size === 0) {
                localizedWarning("wire.warn.select-targets-for-effect");
                await this.activation.applyState("waiting-for-target-confirmation");
            } else {
                await this.activation.assignTargets([...game.user.targets].map(t => t.actor));
                if (isInstantaneous(item)) {
                    await this.activation.template?.delete();
                }
                await this.activation.applyState("idle");
                await this.step(n);
            }

        } else if (isOriginator && this.activation.state === "removeTemplate") {
            await this.activation.template?.delete();
            await this.activation.applyState("idle");
            await this.step(n);

        } else if (isAuthor && this.activation.state === "performAttackDamageRoll") {
            if ((this.activation.effectiveTargets.length && hasDamageOfType(item, applicationType, this.activation.variant)) || hasUnavoidableDamageOfType(item, applicationType, this.activation.variant)) {
                await this.activation.applyState("waiting-for-attack-damage-roll");
                await this.step(n);
            } else {
                await this.activation.applyState("idle");
                await this.step(n);
            }
        } else if (isOriginator && this.activation.state === "rolling-attack-damage") {
            await this.activation.applyState("waiting-for-attack-damage");

            const isCritical = getAttackRollResultType(this.activation.attackRoll) == "critical";
            const spellLevel = this.activation.config?.spellLevel;
            const variant = this.activation.config?.variant;
            const onlyUnavoidable = this.activation.effectiveTargets.length == 0;
            const attackTarget = this.activation.singleTarget?.actor;
            const damageParts = await DamageParts.roll(item, applicationType, onlyUnavoidable, { isCritical, spellLevel, attackTarget, variant });
            await damageParts.roll3dDice();

            await this.activation.applyDamageRollParts(damageParts);
            await this.activation.applyState("idle");
            await this.step(n);

        } else if (isAuthor && this.activation.state === "performSaveDamageRoll") {
            if ((this.activation.effectiveTargets.length && hasDamageOfType(item, applicationType, this.activation.variant)) || hasUnavoidableDamageOfType(item, applicationType, this.activation.variant)) {
                await this.activation.applyState("waiting-for-save-damage-roll");
            } else {
                await this.activation.applyState("idle");
                await this.step(n);
            }
        } else if (isOriginator && this.activation.state === "rolling-save-damage") {
            await this.activation.applyState("waiting-for-save-damage");

            const spellLevel = this.activation.config?.spellLevel;
            const variant = this.activation.config?.variant;
            const damageParts = await DamageParts.roll(item, applicationType, false, { spellLevel, variant });
            await damageParts.roll3dDice();

            await this.activation.applyDamageRollParts(damageParts);
            await this.activation.applyState("idle");
            await this.step(n);

        } else if (isGM && this.activation.state === "performSavingThrow") {
            if (hasOnlyUnavoidableEffectsOfType(item, applicationType, this.activation.variant)) {
                await this.activation.applyEffectiveTargets(this.activation.allTargets.map(a => a.actor));
                await this.activation.applyState("idle");
                await this.step(n);
            } else {
                if (this.activation.message.user === game.user && this.activation.pcTargets.length) {
                    this.activation._createPlayerMessage();
                }
                await this.activation.applyState("waiting-for-saves");
            }
        } else if (isGM && this.activation.state === "waiting-for-saves") {
            if (this.activation.saveResults?.length === this.activation.allTargets.length) {
                const dc = item.data.data.save.dc;
                const failedActors = this.activation.saveResults.filter(r => r.roll.total < dc).map(r => r.actor);
                playAutoAnimation(getActorToken(item.actor), failedActors.map(a => getActorToken(a)), item);
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

        } else if (isGM && this.activation.state === "attackCompleted") {
            await this._triggerAttackConditions();
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

        } else if (isGM && this.activation.state === "triggerAction") {
            await this.activation.applyState("waiting-for-action-trigger");
        } else if (isGM && this.activation.state === "action-trigger-activated") {
            const sourceEffect = this.activation.sourceEffect;
            if (sourceEffect) {
                const condition = sourceEffect.data.flags.wire?.conditions?.find(c => c.condition === "take-an-action");
                const updater = makeUpdater(condition, sourceEffect, item);
                await updater?.process();
            }

            this.activation.message.setFlag("wire", "isHidden", true);
            await this.activation.applyState("idle");

        } else if (isAuthor && this.activation.state === "idle") {
            const flow = this.activation.flowSteps;
            const next = flow.shift();
            await this.activation.updateFlowSteps(flow);
            await this.activation.applyState(next);
            await this.step(n);
        } else if (this.activation.state === "wait") {
            // Allow custom scripts to unblock
        } else if (this.activation.state && !this.knownStates.includes(this.activation.state)) {
            const handlers = this.activation._getCustomFlowStepHandlers();
            const handler = handlers[this.activation.state];
            if (handler) {
                if ((handler.runAsRoller && isOriginator) || (!handler.runAsRoller && isGM)) {
                    await runAndAwait(handler.fn, this.activation);
                    if (this.activation.state !== "wait") {
                        await this.activation.applyState("idle");
                        await this.step(n);
                    }
                }
            } else {
                console.log("UNKNOWN STATE", this.activation.state, ". Maybe run a macro?");
            }
        }
    }

    async _applyDamage() {
        const item = this.activation.item;
        const speaker = item.actor;
        const damageParts = this.activation.damageParts;
        let targets = this.activation.allTargets;
        const effectiveTargets = this.activation.effectiveTargets; // Attack hit or save failed

        for (let tgt of effectiveTargets) {
            if (!targets.find(t => t.actor === tgt.actor)) {
                targets.push(tgt);
            }
        }

        if (damageParts && damageParts.result.length) {
            const targetDamage = await Promise.all(targets
                .map(async target => {
                    const points = await damageParts.appliedToActor(item, target.actor, effectiveTargets.map(t => t.actor).includes(target.actor));
                    return {
                        actor: target.actor,
                        token: target.token,
                        points
                    };
                }));
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
    }

    async _applyConcentration() {
        const item = this.activation.item;
        const actor = item.actor;
        const activationConfig = this.activation.config;
        const conditions = item.getFlag("wire", "conditions");

        let effect;

        const ceApi = game.dfreds?.effectInterface;
        if (ceApi) {
            if (ceApi.hasEffectApplied("Concentrating"), actor.uuid) {
                await ceApi.removeEffect({
                    effectName: "Concentrating",
                    uuid: actor.uuid
                });
            }

            const ceEffect = ceApi.findEffectByName("Concentrating").convertToActiveEffectData({ origin: item.uuid, overlay: false });
            const effectData = duplicate(ceEffect);
            effectData.duration = effectDurationFromItemDuration(item.data.data.duration, isInCombat(actor));
            effectData.flags = foundry.utils.mergeObject(effectData.flags, {
                wire: {
                    isMasterEffect: true,
                    isConcentration: true,
                    activationConfig,
                    conditions
                }
            });

            await this.activation._assignMasterEffectData(effectData);
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
                        isMasterEffect: true,
                        isConcentration: true,
                        activationConfig,
                        conditions
                    }
                }
            };

            await this.activation._assignMasterEffectData(effectData);
        }
    }

    async _applyDurationEffect() {
        const item = this.activation.item;
        const actor = item.actor;
        const activationConfig = this.activation.config;
        const conditions = item.getFlag("wire", "conditions");

        const effectData = {
            changes: [],
            origin: item.uuid,
            disabled: false,
            icon: item.img,
            label: item.name,
            duration: effectDurationFromItemDuration(item.data.data.duration, isInCombat(actor)),
            flags: {
                wire: {
                    isMasterEffect: true,
                    activationConfig,
                    conditions
                }
            }
        };

        await this.activation._assignMasterEffectData(effectData);
    }

    async _applyTargetEffects(applicationType) {
        const originatorUserId = this.activation.message.data.flags.wire?.originatorUserId;
        if (!originatorUserId) { console.warn("Activation message does not have originatorUserId set", this.activation.message); }

        const createdEffects = await applyTargetEffects(
            this.activation.item,
            applicationType,
            this.activation.allTargets.map(t => t.actor),
            this.activation.effectiveTargets.map(t => t.actor),
            this.activation.masterEffect,
            this.activation.config,
            {
                "flags.wire.originatorUserId": originatorUserId
            }
        );

        const actor = this.activation.item.actor;
        const casterDependentEffectUuids = createdEffects.filter(e => isCasterDependentEffect(e)).map(e => e.uuid);
        await actor.setFlag("wire", "turnUpdatedEffectUuids", [...(actor.data.flags.wire?.turnUpdatedEffectUuids || []), ...casterDependentEffectUuids]);

        await this.activation.registerCreatedEffects(createdEffects);
    }

    async _endEffect(force = false) {
        const effect = this.activation.sourceEffect;
        if (effect) {
            if (force || !this.activation.effectiveTargets.length) {
                await effect.delete();
            }
        }
    }

    async _triggerAttackConditions() {
        const attacker = this.activation.item.actor;
        const attackType = this.activation.item.data.data.actionType;
        const attackTarget = this.activation.attackTarget.actor;

        const attackOptions = { 
            ignoredEffects: this.activation.createdEffects,
            details: { attackTargetUuid: attackTarget.uuid }
        };
        const targetOptions = { 
            ignoredEffects: this.activation.createdEffects,
            details: { attackerUuid: attacker.uuid }
        };

        await triggerConditions(attacker, "target-attacks.all", attackOptions);
        await triggerConditions(attacker, `target-attacks.${attackType}`, attackOptions);

        await triggerConditions(attackTarget, "target-is-attacked.all", targetOptions);
        await triggerConditions(attackTarget, `target-is-attacked.${attackType}`, targetOptions);

        if (this.activation.effectiveTargets.length) {
            await triggerConditions(attacker, "target-hits.all", attackOptions);
            await triggerConditions(attacker, `target-hits.${attackType}`, attackOptions);

            await triggerConditions(attackTarget, "target-is-hit.all", targetOptions);
            await triggerConditions(attackTarget, `target-is-hit.${attackType}`, targetOptions);

            const item = this.activation.item;
            const conditions = item.data.flags.wire?.conditions?.filter(c => c.condition === "this-attack-hits") ?? [];
            for (let condition of conditions) {
                const updater = makeUpdater(condition, null, item, attackTarget);
                await updater?.process();
            }
        }
    }

}