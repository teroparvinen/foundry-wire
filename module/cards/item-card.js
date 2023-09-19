import { Activation } from "../activation.js";
import { DamageParts } from "../game/damage-parts.js";
import { fromUuid, fudgeToActor, getActorToken } from "../utils.js";

export class ItemCard {
    static templateName = "modules/wire/templates/item-card.hbs";

    static async renderHtml(item, activation = null, { isPlayerView = false, isSecondary = false } = {}) {
        if (item) {
            const actor = item.actor;
            const token = getActorToken(actor);
            const activationData = await activation?._getChatTemplateData();
    
            const templateData = {
                isGM: isPlayerView ? false : game.user.isGM,
                isPlayerView,
                isGMActorPlayerView: isPlayerView && !actor.hasPlayerOwner && !activation.isPublic,
                hasPlayerOwner: item.hasPlayerOwner,
                actor: actor,
                tokenId: token?.document.uuid || null,
                item: item,
                data: await item.getChatData(),
                isVersatile: item.isVersatile,
                isSpell: item.type === "spell",
                activation: activationData,
                abilityNames: Object.entries(CONFIG.DND5E.abilities).reduce((r, a) => { r[a[0]] = a[1].label; return r; }, {}),
                isSecondary,
                settings: {
                    revealSaveDc: game.settings.get("wire", "reveal-save-dc"),
                    hideNpcSaveResults: game.settings.get("wire", "hide-npc-save-results"),
                    damageRollConfirmsHit: game.settings.get("wire", "damage-roll-confirms-hit")
                }
            };
            return await renderTemplate(this.templateName, templateData);
        }
    }

    constructor(message, activation) {
        this.message = message;
        this.activation = activation;
    }

    async updateContent(options) {
        const activation = this.activation ?? new Activation(this.message);
        const html = await ItemCard.renderHtml(activation.item, activation, options);
        await this.message.update({ content: html, "flags.wire.wasUpdated": true });

        ui.chat.scrollBottom();
    }

    static activateListeners(html) {
        html.off("click", ".wire-item-card .card-buttons button");

        html.on("click", ".wire-item-card .card-buttons button", this._onChatCardAction.bind(this));
        html.on("click", ".wire-item-card .card-phases a", this._onChatCardAction.bind(this));

        html.on("click", ".wire-item-card .card-phases .dice-total", function(event) {
            const tips = event.target.closest('.roll-container').querySelectorAll('.dice-tooltip');
            for (const tip of tips) {
                if ( !tip.classList.contains("expanded") ) $(tip).slideDown(200);
                else $(tip).slideUp(200);
                tip.classList.toggle("expanded");
            }
        });

        html.on("click", ".wire-item-card .save-popup-toggle", function(event) {
            event.target.closest('.phase-saving-throws').classList.toggle('popup');
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

        async function confirmHitIfNecessary() {
            if (activation.attackResult === undefined) {
                await activation.applyAttackResult(true);
            }
        }

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
                await confirmHitIfNecessary();
                activation._rollDamage();
                break;
            case "wire-damage-offhand":
                await confirmHitIfNecessary();
                activation._rollDamage({ damageOffhand: true });
                break;
            case "wire-damage-versatile":
                await confirmHitIfNecessary();
                activation._rollDamage({ damageVersatile: true });
                break;
            case "wire-damage-configure":
                await confirmHitIfNecessary();
                const canCrit = button.dataset.canCrit === "true";
                const isCrit = DamageParts.isCritical(activation);
                const options = {
                    top: event ? event.clientY - 80 : null,
                    left: window.innerWidth - 610,
                    canCrit,
                    isCrit
                }
                activation._rollDamage({}, true, options);
                break;
            case "wire-save":
            case "wire-save-success":
            case "wire-save-failure":
            case "wire-save-config":
                const actorUuid = event.target.closest('.saving-throw-target').dataset.actorId;
                const actor = fudgeToActor(fromUuid(actorUuid));
                if (actor && (game.user.isGM || actor.isOwner)) {
                    const saveOptions = {};
                    if (!!event.altKey && (!!event.metaKey || !!event.ctrlKey)) {
                        Object.assign(saveOptions, { advantage: false, disadvantage: false });
                    } else {
                        if (!!event.altKey) saveOptions.advantage = true;
                        if ((!!event.metaKey || !!event.ctrlKey)) saveOptions.disadvantage = true;
                    }
                    if (action === "wire-save-success") saveOptions.success = true;
                    if (action === "wire-save-failure") saveOptions.failure = true;
                    if (action === "wire-save-config") {
                        saveOptions.useDialog = true;
                        saveOptions.dialogOptions = {
                            top: event ? event.clientY - 80 : null,
                            left: window.innerWidth - 610
                        }
                    }
                    activation._rollSave(actor, saveOptions);
                }
                break;
            case "roll-all-saves":
            case "roll-npc-saves":
                if (game.user.isGM) {
                    const actors = [...event.target
                        .closest('.phase-saving-throws')
                        .querySelectorAll('.saving-throw-target.needs-roll')
                        .values()]
                        .map(e => e.dataset.actorId)
                        .map(i => fudgeToActor(fromUuid(i)))
                        .filter(a => action === "roll-all-saves" || !a.hasPlayerOwner);

                    for (let actor of actors) {
                        activation._rollSave(actor);
                    }
                }
                break;
            case "confirm-targets":
                activation._confirmTargets();
                break;
            case "activate-action":
                activation._activateAction();
                break;
            }

        button.disabled = false;
    }
}