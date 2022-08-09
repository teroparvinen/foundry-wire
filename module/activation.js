import { ItemCard } from "./cards/item-card.js";
import { DamageParts } from "./game/damage-parts.js";
import { Resolver } from "./resolver.js";
import { wireSocket } from "./socket.js";
import { fromUuid, fudgeToActor, getActorToken, getAttackRollResultType } from "./utils.js";

export class Activation {
    static async initializeGmMessage(gmMessage, masterMessage) {
        await masterMessage.setFlag("wire", "gmMessageUuid", gmMessage.uuid);
        await gmMessage.setFlag("wire", "masterMessageUuid", masterMessage.uuid);
        return new Activation(gmMessage);
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
    get state() { return this.data.state; }
    get templateUuid() { return this.data.templateUuid; }
    get masterEffectUuid() { return this.data.masterEffectUuid; }
    get targetUuids() { return this.data.targetUuids; }
    get effectiveTargetUuids() { return this.data.effectiveTargetUuids; }
    get attackRoll() { return this.data.attack?.roll ? CONFIG.Dice.D20Roll.fromData(this.data.attack.roll) : null; }
    get attackResult() { return this.data.attack?.result; }
    get damageParts() { return this.data.damage?.parts ? DamageParts.fromData(this.data.damage.parts) : null; }
    get saveResults() { return this.data.saves?.map(e => {
        return {
            actor: fudgeToActor(fromUuid(e.actorUuid)),
            roll: CONFIG.Dice.D20Roll.fromData(e.roll)
        };
    })}

    get item() {return this.itemUuid ? fromUuid(this.itemUuid) : null; }
    get actor() { return this.item?.actor; }
    get template() { return this.templateUuid ? fromUuid(this.templateUuid) : null; }
    get masterEffect() { return this.masterEffectUuid ? fromUuid(this.masterEffectUuid) : null; }

    get allTargets() { return this.targetUuids?.map(uuid => this._targetRecord(uuid)) ?? []; }
    get pcTargets() { return this.allTargets.filter(t => t.actor.hasPlayerOwner); }
    get singleTarget() { return this._targetRecord(this.targetUuids?.find(t => t)); }
    get effectiveTargets() { return this.effectiveTargetUuids?.map(uuid => this._targetRecord(uuid)) ?? []; }

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
        return {
            state: this.state,
            attack: {
                roll: attackRoll,
                tooltip: attackRollTooltip,
                resultType: attackRollResultType,
                result: this.attackResult 
            },
            damage: {
                roll: damageRoll,
                tooltip: damageRollTooltip
            },
            saves: this.data.saves,
            allTargets: this.allTargets,
            pcTargets: this.pcTargets,
            singleTarget: this.singleTarget
        }
    }

    async initialize(item) {
        foundry.utils.setProperty(this.data, 'itemUuid', item.uuid);
        this.update();
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
        if (!game.user.isGM && this.message.getFlag("wire", "playerMessageUuid")) {
            return;
        }

        // If this is called as a GM on a player roll, you actually want to update the GM card
        const gmMessageUuid = this.message.getFlag("wire", "gmMessageUuid");
        let targetMessage = this.message;
        if (game.user.isGM && gmMessageUuid) {
            targetMessage = fromUuid(gmMessageUuid);
        }
        const card = new ItemCard(targetMessage);
        await card.updateContent();

        // If this is called on a GM card, also update the player view if it is present
        const playerMessageUuid = this.message.getFlag("wire", "playerMessageUuid");
        if (game.user.isGM && playerMessageUuid) {
            const playerMessage = fromUuid(playerMessageUuid);
            const playerCard = new ItemCard(playerMessage);
            await playerCard.updateContent(true);
        }
    }

    async activate() {
        await this.assignTargets([...game.user.targets].map(t => t.actor));

        const resolver = new Resolver(this);
        await resolver.start();
    }

    async step() {
        const resolver = new Resolver(this);
        await resolver.step();
    }

    async assignTemplate(template) {
        await template.setFlag("wire", "activationMessageId", this.message.id);
        foundry.utils.setProperty(this.data, "templateUuid", template.uuid);
        await this.update();
        await this.applyState("area-target-placed");
        await this.step();
    }

    async assignMasterEffect(effect) {
        foundry.utils.setProperty(this.data, "masterEffectUuid", effect.uuid);
        await this.update();

        if (this.templateUuid) {
            await effect.setFlag("wire", "templateUuid", this.templateUuid);
            await this.template.setFlag("wire", "masterEffectUuid", effect.uuid);
        }
    }

    async assignTargets(targets) {
        foundry.utils.setProperty(this.data, "targetUuids", targets.map(t => t.uuid));
        await this.update();
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

    async applyAttackRoll(roll) {
        foundry.utils.setProperty(this.data, "attack.roll", roll.toJSON());
        await this.update();
    }

    async applyAttackResult(result) {
        foundry.utils.setProperty(this.data, "attack.result", result ? "hit" : "miss");
        await this.update();
        await this.step();
    }

    async applyDamageRollParts(damageParts) {
        foundry.utils.setProperty(this.data, "damage.parts", damageParts.toJSON());
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

    async confirmTargets() {
        await this.applyState("targets-confirmed");
        await this.step();
    }

    async rollDamage() {
        if (this.data.state === "waiting-for-attack-damage-roll") {
            await this.applyState("rolling-attack-damage");
        } else {
            await this.applyState("rolling-save-damage");
        }
        await this.step();
    }

    async rollSave(actor, options) {
        const roll = await actor.rollAbilitySave(this.item.data.data.save.ability, foundry.utils.mergeObject(options, { chatMessage: false, fastForward: true }));
        await game.dice3d?.showForRoll(roll, game.user, !game.user.isGM);
        await this.applySave(actor, roll);
    }
}