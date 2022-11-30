import { fromUuid, getSpeaker } from "../utils.js";

export class ConcentrationCard {

    static templateName = "modules/wire/templates/concentration-card.hbs";

    static activateListeners(html) {
        html.on("click", ".concentration-card a", this._onConcentrationCardAction.bind(this));
    }

    static async _onConcentrationCardAction(event) {
        const button = event.currentTarget;
        button.disabled = true;
        const card = button.closest(".chat-card");
        const messageId = card.closest(".message").dataset.messageId;
        const message = game.messages.get(messageId);
        const action = button.dataset.action;

        switch (action) {
        case "concentration-save":
            const card = ConcentrationCard.fromMessage(message);
            if (card.actor.isOwner) {
                const roll = await card.actor.rollAbilitySave("con", { chatMessage: false, fastForward: true });
                await game.dice3d?.showForRoll(roll, game.user, !game.user.isGM);
                await message.setFlag("wire", "result", roll.total);
                card.result = roll.total;
                const content = await card._renderContent();
                message.update({ content });

                if (roll.total < card.dc) {
                    await card.concentrationEffect.delete();
                }
            }
            break;
        default:
            break;
        }

        button.disabled = false;
    }

    static fromMessage(message) {
        const data = message.flags.wire;
        return new ConcentrationCard(fromUuid(data.actorUuid), fromUuid(data.concentrationEffectUuid), data.damageAmount);
    }

    constructor(actor, concentrationEffect, damageAmount) {
        this.actor = actor;
        this.concentrationEffect = concentrationEffect;
        this.damageAmount = damageAmount
    }

    get dc() { return Math.max(Math.floor(this.damageAmount / 2), 10); }

    async make() {
        const flagData = await this._getFlagData();
        const content = await this._renderContent();
        const speaker = getSpeaker(this.actor)

        const messageData = foundry.utils.mergeObject(
            {
                content,
                speaker,
                'flags.wire': flagData
            },
            this.actor.hasPlayerOwner ? {} : {
                user: game.user.id,
                whisper: [game.user.id]
            }
        );
        const message = await ChatMessage.create(messageData);
    }

    async _getFlagData() {
        return {
            actorUuid: this.actor.uuid,
            concentrationEffectUuid: this.concentrationEffect.uuid,
            damageAmount: this.damageAmount
        };
    }

    async _renderContent() {
        const templateData = {
            actor: this.actor,
            damageAmount: this.damageAmount,
            originName: fromUuid(this.concentrationEffect.origin).name,
            dc: this.dc,
            result: this.result
        };
        return await renderTemplate(ConcentrationCard.templateName, templateData);
    }

}