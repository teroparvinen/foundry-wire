import { runInQueue } from "./action-queue.js";
import { ItemCard } from "./cards/item-card.js";
import { Flow } from "./flow.js";
import { DamageParts } from "./game/damage-parts.js";
import { isSelfTarget } from "./item-properties.js";
import { Resolver } from "./resolver.js";
import { wireSocket } from "./socket.js";
import { determineUpdateTargets } from "./updater-utility.js";
import { fromUuid, fudgeToActor, getActorToken, getAttackRollResultType, getSpeaker, i18n } from "./utils.js";

export class Activation {
    static async initializeGmMessage(gmMessage, masterMessage) {
        await masterMessage.setFlag("wire", "gmMessageUuid", gmMessage.uuid);
        await gmMessage.setFlag("wire", "masterMessageUuid", masterMessage.uuid);
        return new Activation(gmMessage);
    }

    static async createConditionMessage(
        condition, item, effect, flow, 
        { revealToPlayers = false, externalTargetActor = null, suppressPlayerMessage = false, speakerIsEffectOwner = false } = {}
    ) {
        const messageData = await item.displayCard({ createMessage: false });
        messageData.content = await ItemCard.renderHtml(item, null, { isSecondary: true });
        messageData.speaker = getSpeaker(speakerIsEffectOwner ? effect.parent : item.actor);
        foundry.utils.setProperty(messageData, "flags.wire.originatorUserId", effect.data.flags.wire?.originatorUserId);
        if (revealToPlayers) { messageData.whisper = null; }
        const message = await ChatMessage.create(messageData);

        if (message) {
            const activation = new Activation(message);

            if (item.hasPlayerOwner && !revealToPlayers && !suppressPlayerMessage) {
                activation.createPlayerMessage();
            }

            await activation.initialize(item, flow.applicationType, flow, condition, effect, externalTargetActor);
            await activation.activate();
        }
    }

    constructor(message) {
        const masterMessageUuid = message.getFlag("wire", "masterMessageUuid");
        let sourceMessage = message;
        if (masterMessageUuid) {
            sourceMessage = fromUuid(masterMessageUuid);
            this.isObserver = true;
        }

        this.message = sourceMessage;
        this.data = sourceMessage.getFlag("wire", "activation") || {};
    }

    get itemUuid() { return this.data.itemUuid; }
    get applicationType() { return this.data.applicationType; }
    get state() { return this.data.state; }
    get flowSteps() { return this.data.flowSteps; }
    get config() { return this.data.config; }
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
    get template() { return this.templateUuid ? fromUuid(this.templateUuid) : null; }
    get masterEffect() { return this.masterEffectUuid ? fromUuid(this.masterEffectUuid) : null; }
    get sourceEffect() { return this.data.sourceEffectUuid ? fromUuid(this.data.sourceEffectUuid) : null; }
    get createdEffects() { return this.data.createdEffectUuids?.map(uuid => fromUuid(uuid)) ?? []; }

    get allTargets() { return this.targetUuids?.map(uuid => this._targetRecord(uuid)) ?? []; }
    get pcTargets() { return this.allTargets.filter(t => t.actor.hasPlayerOwner); }
    get singleTarget() { return this._targetRecord(this.targetUuids?.find(t => t)); }
    get effectiveTargets() { return this.effectiveTargetUuids?.map(uuid => this._targetRecord(uuid)) ?? []; }
    get attackTarget() { return this._targetRecord(this.attackTargetUuid); }

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

    async getChatTemplateData() {
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
                isHealing,
                isTempHps
            },
            saves: this.data.saves,
            allTargets: this.allTargets,
            pcTargets: this.pcTargets,
            singleTarget: this.singleTarget,
            condition: this.localizedCondition,
            customHtml: this.data.customHtml
        }
    }

    async initialize(item, applicationType, flow, condition = null, sourceEffect = null, externalEffectTarget = null) {
        foundry.utils.setProperty(this.data, "itemUuid", item.uuid);
        foundry.utils.setProperty(this.data, "applicationType", applicationType);

        const flowSteps = flow.isEvaluated ? flow.evaluatedSteps : flow.evaluate();
        console.log("FLOW STEPS", flowSteps);
        foundry.utils.setProperty(this.data, "flowSteps", flowSteps);
        this.flow = flow;

        if (condition && sourceEffect) {
            foundry.utils.setProperty(this.data, "condition", condition);
            foundry.utils.setProperty(this.data, "sourceEffectUuid", sourceEffect.uuid);

            foundry.utils.setProperty(this.data, "config", sourceEffect.data.flags.wire?.activationConfig);
            if (sourceEffect.data.flags.wire?.isMasterEffect) {
                foundry.utils.setProperty(this.data, "masterEffectUuid", sourceEffect.uuid);
            } else {
                foundry.utils.setProperty(this.data, "masterEffectUuid", sourceEffect.data.flags.wire?.masterEffectUuid);
            }

            const targetUuids = determineUpdateTargets(item, sourceEffect, condition, externalEffectTarget).map(a => a.uuid);
            foundry.utils.setProperty(this.data, "targetUuids", targetUuids);
        }
        this.update();
    }

    getCustomFlowStepHandlers() {
        if (!this.flow) {
            this.flow = new Flow(this.item, this.applicationType);
            this.flow.evaluate();
        }

        return this.flow.customSteps;
    }

    async update() {
        if (game.user.isGM || this.message.isAuthor) {
            await this.message.setFlag("wire", "activation", this.data);
        } else {
            await wireSocket.executeAsGM("updateMessage", this.message.uuid, this.data);
        }
    }

    async updateCard() {
        // If a player calls this on a view that has a player view (which is managed by the GM), bail out
        if (!game.user.isGM && (this.message.getFlag("wire", "playerMessageUuid") || !this.message.isAuthor)) {
            return;
        }

        const isSecondary = this.data.sourceEffectUuid;

        // If this is called as a GM on a player roll, you actually want to update the GM card
        const gmMessageUuid = this.message.getFlag("wire", "gmMessageUuid");
        let targetMessage = this.message;
        if (game.user.isGM && gmMessageUuid) {
            targetMessage = fromUuid(gmMessageUuid);
        }
        const card = new ItemCard(targetMessage);
        await card.updateContent({ isSecondary });

        // If this is called on a GM card, also update the player view if it is present
        const playerMessageUuid = this.message.getFlag("wire", "playerMessageUuid");
        if (game.user.isGM && playerMessageUuid) {
            const playerMessage = fromUuid(playerMessageUuid);
            const playerCard = new ItemCard(playerMessage);
            const isPlayerView = true;
            await playerCard.updateContent({ isSecondary, isPlayerView });

            wireSocket.executeForOthers("scrollBottom");
        }
    }

    async createPlayerMessage() {
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

    async activate() {
        const resolver = new Resolver(this);
        runInQueue(async () => { await resolver.start(); });
    }

    async step() {
        const resolver = new Resolver(this);
        await runInQueue(async () => { await resolver.step(); });
    }

    async updateFlowSteps(flowSteps) {
        foundry.utils.setProperty(this.data, 'flowSteps', flowSteps);
        this.update();
    }

    async assignTemplate(template) {
        await template.setFlag("wire", "activationMessageId", this.message.id);
        foundry.utils.setProperty(this.data, "templateUuid", template.uuid);
        await this.update();

        if (this.masterEffect) {
            await this.masterEffect.setFlag("wire", "templateUuid", template.uuid);
            await template.setFlag("wire", "masterEffectUuid", this.masterEffectUuid);
        }
    }

    async assignMasterEffect(effect) {
        foundry.utils.setProperty(this.data, "masterEffectUuid", effect.uuid);
        await this.update();

        if (this.template) {
            await effect.setFlag("wire", "templateUuid", this.templateUuid);
            await this.template.setFlag("wire", "masterEffectUuid", effect.uuid);
        }

        await effect.setFlag("wire", "originatorUserId", this.message.data.flags.wire?.originatorUserId);
        await this.registerCreatedEffects([effect]);
    }

    async registerCreatedEffects(effects) {
        await foundry.utils.setProperty(this.data, "createdEffectUuids", [...(this.data.createdEffectUuids || []), ...effects.map(e => e.uuid)]);
        await this.update();
    }

    async registerAttackOptions(options) {
        await foundry.utils.setProperty(this.data, "attack.options", options);
        await this.update();
    }

    async assignTargets(targets) {
        foundry.utils.setProperty(this.data, "targetUuids", targets.map(t => t.uuid));
        await this.update();
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
            const actors = [...game.user.targets].map(t => t.actor);
            await apply(actors);
        }
    }

    async clearTargets() {
        await this.assignTargets([]);
        await this.applyEffectiveTargets([]);
        this.update();
    }

    async assignConfig(config) {
        foundry.utils.setProperty(this.data, "config", config);
        await this.update();
    }

    async assignCustomHtml(html) {
        foundry.utils.setProperty(this.data, "customHtml", html);
        await this.update();
        await this.updateCard();
    }

    async applyEffectiveTargets(targets) {
        foundry.utils.setProperty(this.data, "effectiveTargetUuids", targets.map(t => t.uuid));
        await this.update();
    }

    async applyState(state) {
        console.log("STATE", state, "for message", this.message.id);
        foundry.utils.setProperty(this.data, "state", state);
        await this.update();
        await this.updateCard();
        await wireSocket.executeForOthers("activationUpdated", this.message.uuid);
    }

    async applyAttackTarget(targetActor) {
        foundry.utils.setProperty(this.data, "attack.targetActorUuid", targetActor.uuid);
        await this.update();
    }

    async applyAttackRoll(roll) {
        foundry.utils.setProperty(this.data, "attack.roll", roll.toJSON());
        await this.update();
    }

    async applyAttackResult(result) {
        foundry.utils.setProperty(this.data, "attack.result", result ? "hit" : "miss");
        await this.update();
        await this.step();
    }

    async clearAttack() {
        foundry.utils.setProperty(this.data, "attack.roll", null);
        foundry.utils.setProperty(this.data, "attack.result", null);
        foundry.utils.setProperty(this.data, "attack.targetActorUuid", null);
        await this.update();
    }

    async applyDamageRollParts(damageParts) {
        foundry.utils.setProperty(this.data, "damage.parts", damageParts.toJSON());
        await this.update();
    }

    async clearDamage() {
        foundry.utils.setProperty(this.data, "damage.parts", null);
        await this.update();
    }

    async applySave(actor, roll) {
        const saves = this.data.saves || [];
        if (!saves.find(s => s.actorUuid === actor.uuid)) {
            saves.push({ actorUuid: actor.uuid, roll: roll.toJSON(), isPC: actor.hasPlayerOwner });
            foundry.utils.setProperty(this.data, "saves", saves);

            await this.update();
            await this.updateCard();
    
            await this.step();
            wireSocket.executeForOthers("activationUpdated", this.message.uuid);
        }
    }

    async clearSaves() {
        foundry.utils.setProperty(this.data, "saves", []);
        await this.update();
    }

    async confirmTargets() {
        await this.applyState("targets-confirmed");
        await this.step();
    }

    async activateAction() {
        await this.applyState("action-trigger-activated");
        await this.step();
    }

    async rollDamage() {
        if (this.data.state === "waiting-for-attack-damage-roll") {
            await this.applyState("rolling-attack-damage");
        } else if (this.data.state === "waiting-for-save-damage-roll") {
            await this.applyState("rolling-save-damage");
        }
        await this.step();
    }

    async rollSave(actor, options = {}) {
        const spellDC = this.item.data.data.save.dc;
        if (options.success || options.failure) {
            const formula = options.success ? `1d20min${spellDC}` : `1d20max${spellDC-1}`;
            const roll = await new CONFIG.Dice.D20Roll(formula, {}, { configured: true }).evaluate({ async: true });
            await game.dice3d?.showForRoll(roll, game.user, !game.user.isGM);
            await this.applySave(actor, roll);
            return;
        }

        const roll = await actor.rollAbilitySave(this.item.data.data.save.ability, foundry.utils.mergeObject(options, { chatMessage: false, fastForward: true }));
        await game.dice3d?.showForRoll(roll, game.user, !game.user.isGM);
        await this.applySave(actor, roll);
    }
}