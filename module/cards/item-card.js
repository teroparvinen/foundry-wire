import { Activation } from "../activation.js";
import { fromUuid, fudgeToActor, getActorToken } from "../utils.js";

export class ItemCard {
    static templateName = "modules/wire/templates/item-card.hbs";

    static async renderHtml(item, activation = null, { isPlayerView = false, isSecondary = false } = {}) {
        if (item) {
            const actor = item.actor;
            const token = getActorToken(actor);
            const activationData = await activation?.getChatTemplateData();
    
            const templateData = {
                isGM: isPlayerView ? false : game.user.isGM,
                isPlayerView,
                isGMActorPlayerView: isPlayerView && !actor.hasPlayerOwner,
                hasPlayerOwner: item.hasPlayerOwner,
                actor: actor.data,
                tokenId: token?.uuid || null,
                item: item.data,
                data: item.getChatData(),
                isHealing: item.isHealing,
                isVersatile: item.isVersatile,
                isSpell: item.data.type === "spell",
                activation: activationData,
                abilityNames: CONFIG.DND5E.abilities,
                isSecondary
            };
            return await renderTemplate(this.templateName, templateData);
        }
    }

    constructor(message) {
        this.message = message;
    }

    async updateContent(options) {
        const activation = new Activation(this.message);
        const html = await ItemCard.renderHtml(activation.item, activation, options);
        await this.message.update({ content: html });

        ui.chat.scrollBottom();
    }

    static activateListeners(html) {
        html.on("click", ".card-buttons button", this._onChatCardAction.bind(this));
        html.on("click", ".card-phases a", this._onChatCardAction.bind(this));

        html.on("click", ".card-phases .dice-total", function(event) {
            const tip = event.target.closest('.roll-container').querySelector('.dice-tooltip');
            if ( !tip.classList.contains("expanded") ) $(tip).slideDown(200);
            else $(tip).slideUp(200);
            tip.classList.toggle("expanded");
        });
    }

    static async _onChatCardAction(event) {
        event.preventDefault();

        // Extract card data
        const button = event.currentTarget;
        button.disabled = true;
        const card = button.closest(".chat-card");
        const messageId = card.closest(".message").dataset.messageId;
        const message = game.messages.get(messageId);
        const activation = new Activation(message);
        const action = button.dataset.action;

        switch (action) {
            case "removeTemplate":
                const template = await activation.template;
                template.delete();
                break;
            case "confirm-attack-hit":
                activation.applyAttackResult(true);
                break;
            case "confirm-attack-miss":
                activation.applyAttackResult(false);
                break;
            case "wire-damage":
                activation.rollDamage();
                break;
            case "wire-save":
                const actorUuid = event.target.closest('.saving-throw-target').dataset.actorId;
                const actor = fudgeToActor(fromUuid(actorUuid));
                if (actor && (game.user.isGM || actor.isOwner)) {
                    const advantage = !!event.altKey;
                    const disadvantage = !advantage && !!event.metaKey;
                    activation.rollSave(actor, { advantage, disadvantage });
                }
                break;
            case "roll-all-saves":
            case "roll-npc-saves":
                if (game.user.isGM) {
                    const actors = [...event.target
                        .closest('.phase-saving-throws')
                        .querySelectorAll('.saving-throw-target')
                        .values()]
                        .map(e => e.dataset.actorId)
                        .map(i => fudgeToActor(fromUuid(i)))
                        .filter(a => action === "roll-all-saves" || !a.hasPlayerOwner);

                    for (let actor of actors) {
                        activation.rollSave(actor);
                    }
                }
                break;
            case "confirm-targets":
                activation.confirmTargets();
            }

        button.disabled = false;
    }
}