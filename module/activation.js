import { runInQueue } from "./action-queue.js";
import { ConfigureDamage } from "./apps/configure-damage.js";
import { ItemCard } from "./cards/item-card.js";
import { DocumentProxy } from "./document-proxy.js";
import { Flow } from "./flow.js";
import { itemRollFlow } from "./flows/item-roll.js";
import { DamageParts } from "./game/damage-parts.js";
import { getAbilityCheckOptions, getSaveOptions } from "./game/effect-flags.js";
import { isSelfTarget } from "./item-properties.js";
import { Resolver } from "./resolver.js";
import { wireSocket } from "./socket.js";
import { determineUpdateTargets } from "./updater-utility.js";
import { fromUuid, fudgeToActor, getActorToken, getAttackRollResultType, getSpeaker, handleError, i18n, isActorDefeated, triggerConditions } from "./utils.js";

export class Activation {
    static async _initializeGmMessage(gmMessage, masterMessage) {
        await masterMessage.setFlag("wire", "gmMessageUuid", gmMessage.uuid);
        await gmMessage.setFlag("wire", "masterMessageUuid", masterMessage.uuid);
        return new Activation(gmMessage);
    }

    static async _createConditionMessage(
        condition, item, effect, flow, 
        { revealToPlayers = false, externalTargetActor = null, suppressPlayerMessage = false, speakerIsEffectOwner = false } = {}
    ) {
        const messageData = await item.displayCard({ createMessage: false });
        messageData.content = await ItemCard.renderHtml(item, null, { isSecondary: true });
        messageData.speaker = getSpeaker((speakerIsEffectOwner && effect) ? effect.parent : item.actor);
        foundry.utils.setProperty(messageData, "flags.wire.originatorUserId", effect?.data.flags.wire?.originatorUserId || game.user.id);
        if (revealToPlayers) { messageData.whisper = null; }
        const message = await ChatMessage.create(messageData);

        if (message) {
            const activation = new Activation(message);

            if (item.hasPlayerOwner && !revealToPlayers && !suppressPlayerMessage) {
                activation._createPlayerMessage();
            }

            await activation._initialize(item, flow, { condition, sourceEffect: effect, externalEffectTarget: externalTargetActor });
            await activation._activate();
        }
    }

    async spawnActivation(applicationType, config) {
        const item = this.item;
        const messageData = await item.displayCard({ createMessage: false });
        messageData.content = await ItemCard.renderHtml(item, null, { isSecondary: true });
        foundry.utils.setProperty(messageData, "flags.wire.originatorUserId", game.user.id);
        const message = await ChatMessage.create(messageData);

        if (message) {
            const activation = new Activation(message);
            const flow = new Flow(item, applicationType, itemRollFlow);

            await activation._initialize(item, flow, { isSecondary: true });
            await activation.assignConfig(config);
            await activation._activate();
        }
    }

    constructor(message, data) {
        const masterMessageUuid = message.getFlag("wire", "masterMessageUuid");
        let sourceMessage = message;
        if (masterMessageUuid) {
            sourceMessage = fromUuid(masterMessageUuid);
            this.isObserver = true;
        }

        this.message = sourceMessage;
        this.data = data || sourceMessage.getFlag("wire", "activation") || {};
    }

    get itemUuid() { return this.data.itemUuid; }
    get applicationType() { return this.data.applicationType; }
    get state() { return this.data.state; }
    get flowSteps() { return this.data.flowSteps; }
    get config() { return this.data.config || {}; }
    get variant() { return this.config?.variant; }
    get templateUuid() { return this.data.templateUuid; }
    get masterEffectUuid() { return this.data.masterEffectUuid; }
    get createdEffectUuids() { return this.data.createdEffectUuids; }
    get targetUuids() { return this.data.targetUuids; }
    get effectiveTargetUuids() { return this.data.effectiveTargetUuids; }
    get attackTargetUuid() { return this.data.attack?.targetActorUuid; }
    get attackRoll() { return this.data.attack?.roll ? CONFIG.Dice.D20Roll.fromData(this.data.attack.roll) : null; }
    get attackResult() { return this.data.attack?.result; }
    get attackOptions() { return this.data.attack?.options; }
    get damageParts() { return this.data.damage?.parts ? DamageParts.fromData(this.data.damage.parts) : null; }
    get saveResults() { return this.data.saves?.map(e => {
        return {
            actor: fudgeToActor(fromUuid(e.actorUuid)),
            roll: CONFIG.Dice.D20Roll.fromData(e.roll)
        };
    })}
    get condition() { return this.data.condition; }
    get localizedCondition() { return this.condition ? { 
        condition: i18n(`wire.item.condition-${this.condition.condition}`),
        update: i18n(`wire.item.update-${this.condition.update}`)
    } : null}

    get item() {return this.itemUuid ? fromUuid(this.itemUuid) : null; }
    get actor() { return this.item?.actor; }
    get template() {
        if (this.templateProxy) { return this.templateProxy; }
        return this.templateUuid ? fromUuid(this.templateUuid) : null;
    }
    get masterEffect() {
        if (this.masterEffectProxy) { return this.masterEffectProxy; }
        return this.masterEffectUuid ? fromUuid(this.masterEffectUuid) : null;
    }
    get sourceEffect() { return this.data.sourceEffectUuid ? fromUuid(this.data.sourceEffectUuid) : null; }
    get createdEffects() { return this.data.createdEffectUuids?.map(uuid => fromUuid(uuid)) ?? []; }

    get allTargets() { return this.targetUuids?.map(uuid => this._targetRecord(uuid)) ?? []; }
    get pcTargets() { return this.allTargets.filter(t => t.actor.hasPlayerOwner); }
    get singleTarget() { return this._targetRecord(this.targetUuids?.find(t => t)); }
    get effectiveTargets() { return this.effectiveTargetUuids?.map(uuid => this._targetRecord(uuid)) ?? []; }
    get attackTarget() { return this._targetRecord(this.attackTargetUuid); }

    get abilityToCheckForSave() { return this.condition?.update === "end-on-check" ? (this.item.data.flags.wire?.checkedAbility || this.item.data.data.save?.ability) : null; }

    _targetRecord(uuid) {
        if (uuid) {
            const actor = fudgeToActor(fromUuid(uuid));
            return {
                actor,
                token: getActorToken(actor)
            };
        }
    }

    async getCombinedDamageRoll() { 
        const parts = this.data.damage?.parts;
        if (parts) {
            const damageParts = DamageParts.fromData(this.data.damage.parts);
            return await damageParts.combinedRoll();
        }
    }

    async _getChatTemplateData() {
        const attackRoll = this.attackRoll;
        const attackRollTooltip = await attackRoll?.getTooltip();
        const attackRollResultType = getAttackRollResultType(attackRoll);
        const damageRoll = await this.getCombinedDamageRoll();
        const damageRollTooltip = await damageRoll?.getTooltip();

        const isTempHps = this.item.data.data.damage?.parts?.every(p => p[1] === "temphp") || this.damageParts?.result?.every(p => p.part.type === "temphp");
        const isHealing = !isTempHps && this.item.data.data.damage?.parts?.every(p => ["healing", "temphp"].includes(p[1])) || this.damageParts?.result?.every(p => ["healing", "temphp"].includes(p.part.type));

        return {
            state: this.state,
            attack: {
                roll: attackRoll,
                tooltip: attackRollTooltip,
                resultType: attackRollResultType,
                result: this.attackResult,
                target: this.attackTarget,
                options: this.attackOptions
            },
            damage: {
                roll: damageRoll,
                tooltip: damageRollTooltip,
                isCritical: DamageParts.isCritical(this),
                isHealing,
                isTempHps
            },
            saves: this.data.saves,
            allTargets: this.allTargets,
            pcTargets: this.pcTargets,
            singleTarget: this.singleTarget,
            condition: this.localizedCondition,
            customHtml: this.data.customHtml,
            abilityToCheckForSave: this.abilityToCheckForSave
        }
    }

    async _initialize(item, flow, { condition = null, sourceEffect = null, externalEffectTarget = null, isSecondary = false } = {}) {
        foundry.utils.setProperty(this.data, "itemUuid", item.uuid);
        foundry.utils.setProperty(this.data, "applicationType", flow.applicationType);

        if (condition && sourceEffect) {
            foundry.utils.setProperty(this.data, "condition", condition);
            foundry.utils.setProperty(this.data, "sourceEffectUuid", sourceEffect.uuid);
            foundry.utils.setProperty(this.data, "isSecondary", true);

            foundry.utils.setProperty(this.data, "config", sourceEffect.data.flags.wire?.activationConfig);
            if (sourceEffect.data.flags.wire?.isMasterEffect) {
                foundry.utils.setProperty(this.data, "masterEffectUuid", sourceEffect.uuid);
            } else {
                foundry.utils.setProperty(this.data, "masterEffectUuid", sourceEffect.data.flags.wire?.masterEffectUuid);
            }

            const targetUuids = determineUpdateTargets(item, sourceEffect, condition, externalEffectTarget)?.map(a => a.uuid);
            foundry.utils.setProperty(this.data, "targetUuids", targetUuids);
        } else if (condition) {
            foundry.utils.setProperty(this.data, "condition", condition);
            const targetUuids = determineUpdateTargets(item, sourceEffect, condition, externalEffectTarget)?.map(a => a.uuid);
            foundry.utils.setProperty(this.data, "targetUuids", targetUuids);
        } else {
            if (isSecondary) {
                foundry.utils.setProperty(this.data, "isSecondary", true);
            }
        }

        const flowSteps = flow.isEvaluated ? flow.evaluatedSteps : flow.evaluate();
        console.log("FLOW STEPS", flowSteps);
        foundry.utils.setProperty(this.data, "flowSteps", flowSteps);
        this.flow = flow;

        this._update();
    }

    _getCustomFlowStepHandlers() {
        if (!this.flow) {
            this.flow = new Flow(this.item, this.applicationType);
            this.flow.evaluate();
        }

        return this.flow.customSteps;
    }

    async _update() {
        if (game.user.isGM || this.message.isAuthor) {
            this._updatePending = true;
        } else {
            await wireSocket.executeAsGM("updateMessage", this.message.uuid, this.data);
        }
    }

    async _finalizeUpdate() {
        if (this._updatePending) {
            const template = await this.templateProxy?.commit();
            await this.masterEffectProxy?.commit();
            await this.message.setFlag("wire", "activation", this.data);

            await wireSocket.executeForOthers("activationUpdated", this.message.uuid);

            // Wait for the template to be rendered at least once - avoids a host of problems
            while (template && !template?.object?.controlIcon?.renderable) {
                await new Promise(resolve => {
                    setTimeout(() => { resolve(); }, 100);
                });
            }

            this._updatePending = false;
            this.templateProxy = null;
            this.masterEffectProxy = null;
        }
    }

    async _updateCard() {
        // If a player calls this on a view that has a player view (which is managed by the GM), bail out
        if (!game.user.isGM && (this.message.getFlag("wire", "playerMessageUuid") || !this.message.isAuthor)) {
            return;
        }

        const isSecondary = this.data.isSecondary;

        // If this is called as a GM on a player roll, you actually want to update the GM card
        const gmMessageUuid = this.message.getFlag("wire", "gmMessageUuid");
        let targetMessage = this.message;
        if (game.user.isGM && gmMessageUuid) {
            targetMessage = fromUuid(gmMessageUuid);
        }
        const card = new ItemCard(targetMessage, this);
        await card.updateContent({ isSecondary });

        // If this is called on a GM card, also update the player view if it is present
        const playerMessageUuid = this.message.getFlag("wire", "playerMessageUuid");
        if (game.user.isGM && playerMessageUuid) {
            const playerMessage = fromUuid(playerMessageUuid);
            const playerCard = new ItemCard(playerMessage, this);
            const isPlayerView = true;
            await playerCard.updateContent({ isSecondary, isPlayerView });

            wireSocket.executeForOthers("scrollBottom");
        }
    }

    async _createPlayerMessage() {
        const playerMessageData = {
            content: await ItemCard.renderHtml(this.item, this, { isPlayerView: true }),
            flags: {
                wire: {
                    masterMessageUuid: this.message.uuid,
                    originatorUserId: this.message.data.flags.wire?.originatorUserId,
                    isPlayerView: true
                }
            },
            speaker: this.message.data.speaker,
            user: game.user.id
        };
        const playerMessage = await ChatMessage.create(playerMessageData);
        this.message.setFlag("wire", "playerMessageUuid", playerMessage.uuid);

        ui.chat.scrollBottom();
    }

    async _activate() {
        const resolver = new Resolver(this);
        runInQueue(async () => {
            try {
                await resolver.start();
                await this._finalizeUpdate();
            } catch (error) {
                handleError(error);
            }
        });
    }

    async _step() {
        const resolver = new Resolver(this);
        await runInQueue(async () => {
            try {
                await resolver.step();
                await this._finalizeUpdate();
            } catch (error) {
                handleError(error);
            }
        });
    }

    async updateFlowSteps(flowSteps) {
        foundry.utils.setProperty(this.data, 'flowSteps', flowSteps);
        await this._update();
    }

    async _assignTemplateData(templateData) {
        this.templateProxy = new DocumentProxy(game.scenes.current, "MeasuredTemplate", templateData);

        this.templateProxy.setFlag("wire", "activationMessageId", this.message.id);

        foundry.utils.setProperty(this.data, "templateUuid", this.templateProxy.uuid);
        await this._update();
    }

    async _assignMasterEffectData(effectData) {
        this.masterEffectProxy = new DocumentProxy(this.actor, "ActiveEffect", effectData);

        foundry.utils.setProperty(this.data, "masterEffectUuid", this.masterEffectProxy.uuid);
        await this._update();

        if (this.templateProxy) {
            await this.masterEffectProxy.setFlag("wire", "templateUuid", this.templateUuid);
            await this.templateProxy.setFlag("wire", "masterEffectUuid", this.masterEffectUuid);
        }

        await this.masterEffectProxy.setFlag("wire", "originatorUserId", this.message.data.flags.wire?.originatorUserId);
        await this.registerCreatedEffects([this.masterEffectProxy]);
    }

    async registerCreatedEffects(effects) {
        await foundry.utils.setProperty(this.data, "createdEffectUuids", [...(this.data.createdEffectUuids || []), ...effects.map(e => e.uuid)]);
        await this._update();
    }

    async registerAttackOptions(options) {
        await foundry.utils.setProperty(this.data, "attack.options", options);
        await this._update();
    }

    async assignTargets(targets) {
        foundry.utils.setProperty(this.data, "targetUuids", targets.filter(a => !isActorDefeated(a)).map(t => t.uuid));
        await this._update();
    }

    async assignDefaultTargets(makeEffective) {
        const apply = async (targets) => {
            await this.assignTargets(targets);
            if (makeEffective) { await this.applyEffectiveTargets(targets); }
        }

        if (isSelfTarget(this.item) || (this.allTargets.length == 0 && game.user.targets.size == 0)) {
            await apply([this.item.actor]);
        } else if (this.allTargets.length) {
            if (makeEffective) { await this.applyEffectiveTargets(this.allTargets.map(t => t.actor)); }
        } else if (game.user.targets.size) {
            const actors = [...game.user.targets].map(t => t.actor).filter(a => !isActorDefeated(a));
            await apply(actors);
        }
    }

    async clearTargets() {
        await this.assignTargets([]);
        await this.applyEffectiveTargets([]);
        await this._update();
    }

    async assignConfig(config) {
        if (this.sourceEffect) {
            await this.sourceEffect.setFlag("wire", "activationConfig", config);
        }

        foundry.utils.setProperty(this.data, "config", config);
        await this._update();
    }

    async assignCustomHtml(html) {
        foundry.utils.setProperty(this.data, "customHtml", html);
        await this._update();
        await this._updateCard();
    }

    async applyEffectiveTargets(targets) {
        foundry.utils.setProperty(this.data, "effectiveTargetUuids", targets.filter(a => !isActorDefeated(a)).map(t => t.uuid));
        await this._update();
    }

    async applyState(state) {
        console.log("STATE", state, "for message", this.message.id);
        foundry.utils.setProperty(this.data, "state", state);
        await this._update();
        await this._updateCard();
        await wireSocket.executeForOthers("refreshActivation", this.message.uuid, this.data);
    }

    async wait() {
        await this.applyState("wait");
    }

    async continue() {
        await this.applyState("idle");
        await this._step();
    }

    async applyAttackTarget(targetActor) {
        foundry.utils.setProperty(this.data, "attack.targetActorUuid", targetActor.uuid);
        await this._update();
    }

    async applyAttackRoll(roll) {
        foundry.utils.setProperty(this.data, "attack.roll", roll.toJSON());
        await this._update();
    }

    async applyAttackResult(result) {
        foundry.utils.setProperty(this.data, "attack.result", result ? "hit" : "miss");
        await this._update();
        await this._step();
    }

    async clearAttack() {
        foundry.utils.setProperty(this.data, "attack.roll", null);
        foundry.utils.setProperty(this.data, "attack.result", null);
        foundry.utils.setProperty(this.data, "attack.targetActorUuid", null);
        await this._update();
    }

    async applyDamageRollParts(damageParts) {
        foundry.utils.setProperty(this.data, "damage.parts", damageParts.toJSON());
        await this._update();
    }

    async clearDamage() {
        foundry.utils.setProperty(this.data, "damage.parts", null);
        await this._update();
    }

    async applySave(actor, roll) {
        const saves = this.data.saves || [];
        if (!saves.find(s => s.actorUuid === actor.uuid)) {
            saves.push({ actorUuid: actor.uuid, roll: roll.toJSON(), isPC: actor.hasPlayerOwner });
            foundry.utils.setProperty(this.data, "saves", saves);

            await this._update();
            await this._updateCard();
    
            await this._step();
            wireSocket.executeForOthers("refreshActivation", this.message.uuid, this.data);
        }
    }

    async clearSaves() {
        foundry.utils.setProperty(this.data, "saves", []);
        await this._update();
    }

    async _confirmTargets() {
        await this.applyState("targets-confirmed");
        await this._step();
    }

    async _activateAction() {
        await this.applyState("action-trigger-activated");
        await this._step();
    }

    async _rollDamage(doDialog, dialogOptions) {
        let additionalDamage;

        const situationalBonus = await triggerConditions(this.item.actor, "prepare-damage-roll");

        if (doDialog) {
            const configuration = new ConfigureDamage(this, dialogOptions, situationalBonus);
            additionalDamage = await configuration.render(true);
        } else {
            additionalDamage = situationalBonus;
        }

        foundry.utils.setProperty(this.data, 'config.damageBonus', additionalDamage);
        await this._update();

        if (this.data.state === "waiting-for-attack-damage-roll") {
            await this.applyState("rolling-attack-damage");
        } else if (this.data.state === "waiting-for-save-damage-roll") {
            await this.applyState("rolling-save-damage");
        }
        await this._step();
    }

    async _rollSave(actor, options = {}) {
        const spellDC = this.item.data.data.save.dc;
        const usedSave = this.item.data.data.save.ability;
        const usedCheck = this.abilityToCheckForSave;

        const actorOptions = usedCheck ? getAbilityCheckOptions(actor, usedCheck) : getSaveOptions(actor, usedSave);
        const rollOptions = foundry.utils.mergeObject(actorOptions, options);

        if (rollOptions.success || rollOptions.failure) {
            const formula = rollOptions.success ? `1d20min${spellDC}` : `1d20max${spellDC-1}`;
            const roll = await new CONFIG.Dice.D20Roll(formula, {}, { configured: true }).evaluate({ async: true });
            await this.applySave(actor, roll);
        } else {
            let roll;
            if (usedCheck) {
                roll = await actor.rollAbilityTest(usedCheck, foundry.utils.mergeObject(rollOptions, { chatMessage: false, fastForward: true }));
            } else {
                roll = await actor.rollAbilitySave(usedSave, foundry.utils.mergeObject(rollOptions, { chatMessage: false, fastForward: true }));
            }
            await game.dice3d?.showForRoll(roll, game.user, !game.user.isGM);
            await this.applySave(actor, roll);
        }

        await triggerConditions(actor, "saving-throw-completed");
    }
}