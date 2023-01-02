import { runInQueue } from "./action-queue.js";
import { ConfigureAttack } from "./apps/configure-attack.js";
import { DamageCard } from "./cards/damage-card.js";
import { applyTargetEffects } from "./game/active-effects.js";
import { DamageParts } from "./game/damage-parts.js";
import { getAttackOptions } from "./game/effect-flags.js";
import { hasApplicationsOfType, hasDamageOfType, hasEffectsOfType, hasOnlyUnavoidableApplicationsOfType, hasUnavoidableDamageOfType, isAttack, isInstantaneous, isSpell } from "./item-properties.js";
import { createTemplate } from "./templates.js";
import { makeUpdater } from "./updater-utility.js";
import { areAllied, effectDurationFromItemDuration, fromUuid, fudgeToActor, getActorToken, i18n, isActorImmune, isCasterDependentEffect, isInCombat, localizedWarning, playAutoAnimation, runAndAwait, triggerConditions } from "./utils.js";

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
        "attack-configured",
        "applyConcentration", 
        "applyDamage", 
        "applyDefaultTargets",
        "applyDefaultTargetsAsEffective",
        "applyDurationEffect", 
        "applyEffects",
        "applySelectedTargets",
        "applySelectedTargetsAsEffective",
        "applySelectedTargetsAlliesAsEffective",
        "applyTargetFromCondition",
        "attackCompleted",
        "confirmTargets",
        "configure-attack",
        "detachTemplate",
        "idle", 
        "performAttackDamageRoll",
        "performAttackRoll", 
        "performSaveDamageRoll", 
        "performSavingThrow",
        "performSavingThrowAlways",
        "placeTemplate",
        "promptVariant",
        "removeSelfTarget",
        "rolling-attack-damage", 
        "rolling-save-damage",
        "saves-completed",
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
        const isOriginator = this.activation.message.flags.wire?.originatorUserId === game.user.id;

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
            await this._applyResolvingEffects();
            await this.activation.applyState("idle");
            await this.step(n);
        } else if (isAuthor && this.activation.state === "applySelectedTargetsAsEffective") {
            const targets = [...game.user.targets].map(t => t.actor);
            await this.activation.assignTargets(targets);
            await this._applyResolvingEffects();
            await this.activation.applyEffectiveTargets(targets);
            await this.activation.applyState("idle");
            await this.step(n);

        } else if (isAuthor && this.activation.state === "applySelectedTargetsAlliesAsEffective") {
            const targets = [...game.user.targets].map(t => t.actor);
            await this.activation.assignTargets(targets);
            await this._applyResolvingEffects();
            await this.activation.applyEffectiveTargets(targets.filter(a => areAllied(a, item.actor)));
            await this.activation.applyState("idle");
            await this.step(n);

        } else if (isAuthor && this.activation.state === "applyTargetFromCondition") {
            const conditionDetails = this.activation.condition?.details;
            const targetActor = fudgeToActor(fromUuid(conditionDetails?.attackTargetUuid) || fromUuid(conditionDetails?.attackerUuid));
            const targetActors = targetActor ? [targetActor] : [];
            await this.activation.assignTargets(targetActors);
            await this._applyResolvingEffects();
            await this.activation.applyState("idle");
            await this.step(n);
        } else if (isAuthor && this.activation.state === "applyTargetFromConditionAsEffective") {
            const conditionDetails = this.activation.condition?.details;
            const targetActor = fudgeToActor(fromUuid(conditionDetails?.attackTargetUuid) || fromUuid(conditionDetails?.attackerUuid));
            const targetActors = targetActor ? [targetActor] : [];
            await this.activation.assignTargets(targetActors);
            await this.activation.applyEffectiveTargets(targetActors);
            await this._applyResolvingEffects();
            await this.activation.applyState("idle");
            await this.step(n);

        } else if (isOriginator && this.activation.state === "removeSelfTarget") {
            await this.activation.removeTarget(item.actor);
            const token = getActorToken(item.actor);
            if (token && token.isTargeted) {
                token.setTarget(false, { releaseOthers: false });
            }
            await this.activation.applyState("idle");
            await this.step(n);

        } else if (isOriginator && this.activation.state === "performAttackRoll") {
            const preparationResult = await triggerConditions(item.actor, "prepare-attack-roll");
            const config = duplicate(this.activation.config);

            if (preparationResult) {
                if (typeof preparationResult === "string" || typeof preparationResult === "number") {
                    setProperty(config, "attack.bonus", preparationResult);
                } else if (typeof preparationResult === "object") {
                    if (preparationResult.bonus) {
                        setProperty(config, "attack.bonus", preparationResult.bonus);
                    }
                    if (preparationResult.advantage !== undefined) {
                        setProperty(config, "attack.advantage", preparationResult.advantage);
                    }
                    if (preparationResult.disadvantage !== undefined) {
                        setProperty(config, "attack.disadvantage", preparationResult.disadvantage);
                    }
                }

                await this.activation.assignConfig(config);
            }

            if (this.activation.config.attack?.useDialog) {
                await this.activation.applyState("configure-attack");
                await this.step(n);
            } else {
                await this.activation.applyState("attack-configured", true);
                await this.step(n);
            }
        } else if (isOriginator && this.activation.state === "configure-attack") {
            const config = this.activation.config;
            const app = new ConfigureAttack(item, config);
            const result = await app.render(true);

            if (result != undefined) {
                await this.activation.assignConfig(result);
                await this.activation.applyState("attack-configured", true);
                await this.step(n);
            }
        } else if (isOriginator && this.activation.state === "attack-configured") {
            if (!this.activation.singleTarget) {
                localizedWarning("wire.warn.resolve-performAttackRoll-noTarget");
            }
            const options = await getAttackOptions(this.activation.item, this.activation.singleTarget.actor, this.activation.config);
            playAutoAnimation(getActorToken(item.actor), [this.activation.singleTarget.token], item);
            const roll = await item.rollAttack(foundry.utils.mergeObject({ chatMessage: false, fastForward: true }, options));
            await game.dice3d?.showForRoll(roll, game.user, !game.user.isGM);
            await this.activation.applyAttackTarget(this.activation.singleTarget.actor);
            await this.activation.applyAttackRoll(roll);
            await this.activation.registerAttackOptions(options);
            await this.activation.applyState("waiting-for-attack-result", true);
        } else if (isGM && this.activation.state === "waiting-for-attack-result") {
            if (this.activation.attackResult == "hit") {
                await this.activation.applyEffectiveTargets([this.activation.singleTarget.actor]);
                await this.activation.applyState("idle", true);
                await this.step(n);
            } else if (this.activation.attackResult == "miss") {
                await this.activation.applyState("idle", true);
                await this.step(n);
            }

        } else if (isOriginator && this.activation.state === "promptVariant") {
            const options = this.activation.config.variantOptions;
            if (options?.length) {
                const variant = await new game.wire.SelectVariantDialog(item, options).render(true);
                await this.activation.assignConfig({ ...this.activation.config, variant });
            }
            await this.activation.applyState("idle", true);
            await this.step(n);

        } else if (isAuthor && this.activation.state === "confirmTargets") {
            if (hasApplicationsOfType(item, this.activation.applicationType, this.activation.variant)) {
                await this.activation.applyState("waiting-for-target-confirmation", true);
            } else {
                await this.activation.applyState("targets-confirmed");
                await this.step(n);
            }
        } else if (isOriginator && this.activation.state === "targets-confirmed") {
            let doContinue = true;
            if (game.user.targets.size === 0) {
                doContinue = false;
                await Dialog.confirm({
                    title: game.i18n.localize("wire.ui.confirm-no-targets-title"),
                    content: game.i18n.localize("wire.ui.confirm-no-targets-content"),
                    yes: () => { doContinue = true },
                    no: () => {},
                    defaultYes: true
                });
            }
            if (doContinue) {
                await this.activation.assignTargets([...game.user.targets].map(t => t.actor));
                await this._applyResolvingEffects();
                if (isInstantaneous(item)) {
                    await this.activation.template?.delete();
                }
                await this.activation.applyState("idle", true);
                await this.step(n);
            } else {
                await this.activation.applyState("waiting-for-target-confirmation", true);
            }

        } else if (isOriginator && this.activation.state === "placeTemplate") {
            const token = getActorToken(item.actor);
            if (token && !this.activation.templateUuid) {
                const templateData = await createTemplate(item, this.activation.config, this.activation.applicationType, { disableTargetSelection: false, preventCancel: true });
                await this.activation.assignTemplateData(templateData);
            }    
            await this.activation.applyState("idle");
            await this.step(n);
        } else if (isOriginator && this.activation.state === "removeTemplate") {
            await this.activation.template?.delete();
            await this.activation.applyState("idle");
            await this.step(n);
        } else if (isOriginator && this.activation.state === "detachTemplate") {
            runInQueue(async () => {
                const templateDoc = this.activation.template;

                const attachedTokenId = templateDoc.getFlag("wire", "attachedTokenId");
                if (attachedTokenId) {
                    const token = canvas.tokens.get(attachedTokenId);
                    await token?.document.unsetFlag("wire", "attachedTemplateId");
                    await templateDoc.unsetFlag("wire", "attachedTokenId");
                }
    
            });
            await this.activation.applyState("idle");
            await this.step(n);

        } else if (isAuthor && this.activation.state === "performAttackDamageRoll") {
            if ((this.activation.effectiveTargets.length && hasDamageOfType(item, applicationType, this.activation.variant)) || hasUnavoidableDamageOfType(item, applicationType, this.activation.variant)) {
                await this.activation.applyState("waiting-for-attack-damage-roll", true);
                await this.step(n);
            } else {
                await this.activation.applyState("idle");
                await this.step(n);
            }
        } else if (isOriginator && this.activation.state === "rolling-attack-damage") {
            await this.activation.applyState("waiting-for-attack-damage", true);

            const damageParts = await DamageParts.roll(this.activation, true);
            await damageParts.roll3dDice();

            await this.activation.applyDamageRollParts(damageParts);
            await this.activation.applyState("idle", true);
            await this.step(n);

        } else if (isAuthor && this.activation.state === "performSaveDamageRoll") {
            if ((this.activation.effectiveTargets.length && hasDamageOfType(item, applicationType, this.activation.variant)) || 
                (this.activation.allTargets.length && hasUnavoidableDamageOfType(item, applicationType, this.activation.variant))) {
                await this.activation.applyState("waiting-for-save-damage-roll", true);
            } else {
                await this.activation.applyState("idle");
                await this.step(n);
            }
        } else if (isOriginator && this.activation.state === "rolling-save-damage") {
            await this.activation.applyState("waiting-for-save-damage", true);

            const damageParts = await DamageParts.roll(this.activation, false);
            await damageParts.roll3dDice();

            await this.activation.applyDamageRollParts(damageParts);
            await this.activation.applyState("idle", true);
            await this.step(n);

        } else if (isGM && this.activation.state === "performSavingThrow") {
            if (hasOnlyUnavoidableApplicationsOfType(item, applicationType, this.activation.variant)) {
                await this.activation.applyEffectiveTargets(this.activation.allTargets.map(a => a.actor));
                await this.activation.applyState("idle");
                await this.step(n);
            } else if (this.activation.allTargets.length === this.activation.effectiveTargets.length) {
                await this.activation.applyState("idle", true);
                await this.step(n);
            } else {
                if (this.activation.message.user === game.user && this.activation.pcTargets.length) {
                    this.activation._createPlayerMessage(true);
                }
                await this.activation._applyAutoSaves();
                if (this.activation.saveResults?.length === this.activation.allTargets.length) {
                    await this.activation.applyState("saves-completed", true);
                    await this.step(n);
                } else {
                    await this.activation.applyState("waiting-for-saves", true);
                }
            }
        } else if (isGM && this.activation.state === "performSavingThrowAlways") {
            if (this.activation.message.user === game.user && this.activation.pcTargets.length) {
                this.activation._createPlayerMessage(true);
            }
            await this.activation._applyAutoSaves();
            if (this.activation.saveResults?.length === this.activation.allTargets.length) {
                await this.activation.applyState("saves-completed", true);
                await this.step(n);
            } else {
                await this.activation.applyState("waiting-for-saves", true);
            }
        } else if (isGM && this.activation.state === "waiting-for-saves") {
            if (this.activation.saveResults?.length === this.activation.allTargets.length) {
                await this.activation.applyState("saves-completed", true);
                await this.step(n);
            }
        } else if (isGM && this.activation.state === "saves-completed") {
            const dc = item.system.save.dc;

            const failedActors = this.activation.saveResults.filter(r => r.roll.total < dc).map(r => r.actor);
            playAutoAnimation(getActorToken(item.actor), failedActors.map(a => getActorToken(a)), item);
            await this.activation.applyEffectiveTargets(failedActors);

            if (item.flags.wire?.saveImmunity) {
                const successActors = this.activation.saveResults.filter(r => r.roll.total >= dc).map(r => r.actor);
                for (const actor of successActors) {
                    if (!isActorImmune(actor, item)) {
                        await this._applyImmunityEffect(actor);
                    }
                }
            }

            await this.activation.applyState("idle", true);
            await this.step(n);

        } else if (isGM && this.activation.state === "applyDamage") {
            await this._applyDamage();
            await this.activation.applyState("idle");
            await this.step(n);

        } else if (isGM && this.activation.state === "applyEffects") {
            await this._applyTargetEffects(applicationType);
            await this.activation.applyState("idle");
            await this.step(n);

        } else if (isGM && this.activation.state === "attackCompleted") {
            // await this._triggerAttackConditions();
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
            await this.activation.applyState("waiting-for-action-trigger", true);
        } else if (isGM && this.activation.state === "action-trigger-activated") {
            const sourceEffect = this.activation.sourceEffect;
            if (sourceEffect) {
                const condition = sourceEffect.flags.wire?.conditions?.find(c => c.condition === "take-an-action");
                const updater = makeUpdater(condition, sourceEffect, item);
                await updater?.process();
            }

            this.activation.message.setFlag("wire", "isHidden", true);
            await this.activation.applyState("idle", true);

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
                    const ret = await runAndAwait(handler.fn, this.activation, this.activation.condition?.details);
                    if (ret === false) {
                        await this.activation.stop();
                    }
                    if (this.activation.state !== "wait") {
                        await this.activation.applyState("idle");
                        await this.step(n);
                    }
                }
            } else {
                console.log("UNKNOWN STATE", this.activation.state, ". Maybe run a macro?");
            }
        } else if (!this.activation.state) {
            if (this.activation.attackResult) {
                await this._triggerAttackConditions();
            }
            if (this.activation.isPrimaryRoll && isSpell(item)) {
                await this._triggerSpellCastConditions();
            }

            if (isInstantaneous(item)) {
                const createdEffects = this.activation.createdEffects.filter(e => !e.flags.wire?.independentDuration);
                runInQueue(async () => {
                    for (const effect of createdEffects) {
                        await effect.delete();
                    }
                });
            }

            const resolvingEffects = this.activation.createdEffects.filter(e => e && e.flags.wire?.applicationType === "resolving");
            runInQueue(async () => {
                for (const effect of resolvingEffects) {
                    await effect.delete();
                }
            });

            if (this.activation.config.deleteItem) {
                await item.delete();
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
                    const points = await damageParts.appliedToActor(item, target.actor, effectiveTargets.map(t => t.actor).includes(target.actor), this.activation);
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
                await DamageCard.make(speaker, pcDamage);
            }
            if (npcDamage.length) {
                await DamageCard.make(speaker, npcDamage);
            }
            if (!pcDamage.length && !npcDamage.length) {
                await DamageCard.make(speaker, []);
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
            effectData.duration = effectDurationFromItemDuration(item.system.duration, isInCombat(actor));
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

            await item.actor.effects.find(e => e.label === concentratingLabel)?.delete();
    
            const effectData = {
                changes: [],
                origin: item.uuid,
                disabled: false,
                icon: "modules/wire/icons/concentrating.svg",
                label: concentratingLabel,
                duration: effectDurationFromItemDuration(item.system.duration, isInCombat(actor)),
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
            duration: effectDurationFromItemDuration(item.system.duration, isInCombat(actor)),
            flags: {
                wire: {
                    isMasterEffect: true,
                    activationConfig,
                    conditions
                },
                core: {
                    statusId: " "
                }
            }
        };

        await this.activation._assignMasterEffectData(effectData);
    }

    async _applyResolvingEffects() {
        if (hasEffectsOfType(this.activation.item, "resolving", this.activation.variant)) {
            await this._applyTargetEffects("resolving", { allEffective: true });
        }
    }

    async _applyImmunityEffect(actor) {
        const item = this.activation.item;
        const label = i18n("wire.effect-immunity", { itemName: item.name });
        await actor.createEmbeddedDocuments("ActiveEffect", [{
            changes: [],
            origin: item.uuid,
            disabled: false,
            icon: "modules/wire/icons/effect-immunity.svg",
            label: label,
            flags: {
                wire: {
                    immuneItemUuid: item.uuid
                },
                core: {
                    statusId: " "
                }
            }
        }]);
    }

    async _applyTargetEffects(applicationType, { allEffective = false } = {}) {
        const originatorUserId = this.activation.message.flags.wire?.originatorUserId;
        if (!originatorUserId) { console.warn("Activation message does not have originatorUserId set", this.activation.message); }

        const allTargets = this.activation.allTargets;
        const effectiveTargets = allEffective ? allTargets : this.activation.effectiveTargets;

        const createdEffects = await applyTargetEffects(
            this.activation.item,
            applicationType,
            allTargets.map(t => t.actor),
            effectiveTargets.map(t => t.actor),
            this.activation.masterEffect,
            this.activation.config,
            {
                "flags.wire.originatorUserId": originatorUserId
            }
        );

        const actor = this.activation.item.actor;
        const casterDependentEffectUuids = createdEffects.filter(e => isCasterDependentEffect(e)).map(e => e.uuid);
        await actor.setFlag("wire", "turnUpdatedEffectUuids", [...(actor.flags.wire?.turnUpdatedEffectUuids || []), ...casterDependentEffectUuids]);

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
        const attackType = this.activation.item.system.actionType;
        const attackTarget = this.activation.attackTarget?.actor;

        if (attackTarget) {
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
                const conditions = item.flags.wire?.conditions?.filter(c => c.condition === "this-attack-hits") ?? [];
                for (let condition of conditions) {
                    const updater = makeUpdater(condition, null, item, attackTarget);
                    await updater?.process();
                }
            }
        }
    }

    async _triggerSpellCastConditions() {
        const caster = this.activation.item.actor;
        await triggerConditions(caster, "target-casts-spell", { ignoredEffects: this.activation.createdEffects });
    }

}