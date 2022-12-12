import { fromUuid, fudgeToActor, getActorToken, getSpeaker } from "../utils.js";

export class DeathSaveCard {

    static templateName = "modules/wire/templates/death-save-card.hbs";

    static activateListeners(html) {
        html.on("click", ".death-save-card a", this._onDeathSaveCardAction.bind(this));
    }

    static async _onDeathSaveCardAction(event) {
        const button = event.currentTarget;
        button.disabled = true;
        const card = button.closest(".chat-card");
        const messageId = card.closest(".message").dataset.messageId;
        const message = game.messages.get(messageId);
        const action = button.dataset.action;

        switch (action) {
        case "death-save":
            const card = DeathSaveCard.fromMessage(message);
            if (card.actor.isOwner) {
                const options = { chatMessage: false, fastForward: true };
                if (event.altKey) { options.advantage = true; }
                if (event.metaKey || event.ctrlKey) { options.disadvantage = true; }

                const roll = await card.actor.rollDeathSave(options);
                await game.dice3d?.showForRoll(roll, game.user, !game.user.isGM);
                await message.setFlag("wire", "result", roll.total);
                card.result = roll.total;
                const content = await card._renderContent();
                message.update({ content });
            }
            break;
        default:
            break;
        }

        button.disabled = false;
    }

    static fromMessage(message) {
        const data = message.flags.wire;
        return new DeathSaveCard(fudgeToActor(fromUuid(data.actorUuid)));
    }

    constructor(actor) {
        this.actor = actor;
    }

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
            isDeathSaveCard: true,
            actorUuid: this.actor.uuid
        };
    }

    async _renderContent() {
        const templateData = {
            actor: this.actor,
            token: getActorToken(this.actor),
            result: this.result
        };
        return await renderTemplate(DeathSaveCard.templateName, templateData);
    }

}