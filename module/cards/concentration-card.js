import { getSaveOptions } from "../game/effect-flags.js";
import { fromUuid, fudgeToActor, getActorToken, getSpeaker, i18n } from "../utils.js";
import { getDisplayableSaveComponents } from "../game/check-and-save-components.js";
import { wireSocket } from "../socket.js";

export async function requestConcentrationSave(actor, dc = 10) {
    const concentrationEffect = actor.effects.find(e => e.flags.wire?.isConcentration);
    if (concentrationEffect) {
        const concentrationCard = new ConcentrationCard(actor, concentrationEffect, { dc });
        await concentrationCard.make();
    }
}

export class ConcentrationCard {

    static templateName = "modules/wire/templates/concentration-card.hbs";

    static activateListeners(html) {
        html.on("click", ".concentration-card a, .concentration-card button", this._onConcentrationCardAction.bind(this));
    }

    static async _onConcentrationCardAction(event) {
        const button = event.currentTarget;
        button.disabled = true;
        const chatCard = button.closest(".chat-card");
        const messageId = chatCard.closest(".message").dataset.messageId;
        const message = game.messages.get(messageId);
        const action = button.dataset.action;
        const card = ConcentrationCard.fromMessage(message);

        switch (action) {
        case "concentration-save":
        case "concentration-save-config":
            if (card.actor.isOwner) {
                let failed = false;
                const updates = {};
                const { success, failure } = getSaveOptions(card.actor, "con", undefined, { isConcentration: true });
                if (success) {
                    updates["flags.wire.result"] = "success";
                    card.result = "success";
                } else if (failure) {
                    updates["flags.wire.result"] = "failure";
                    card.result = "failure";
                    failed = true;
                } else {
                    const useDialog = action === "concentration-save-config";
                    const options = { chatMessage: false, fastForward: !useDialog, isConcentration: true };

                    if (useDialog) {
                        options.dialogOptions = {
                            top: event ? event.clientY - 80 : null,
                            left: window.innerWidth - 610,
                            title: i18n("wire.configure-check.concentration-title"),
                            wire: {
                                rollType: "save",
                                components: getDisplayableSaveComponents(card.actor, "con")
                            }
                        }
                    } else {
                        if (event.altKey && (event.metaKey || event.ctrlKey)) { options.normal = true; }
                        else if (event.altKey) { options.advantage = true; }
                        else if (event.metaKey || event.ctrlKey) { options.disadvantage = true; }
                    }

                    const roll = await card.actor.rollAbilitySave("con", options);
                    if (!roll) { return; }
                    await game.dice3d?.showForRoll(roll, game.user, !game.user.isGM);
                    updates["flags.wire.result"] = roll.total;
                    card.result = roll.total;
                    if (roll.total < card.dc) {
                        failed = true;
                    }
                }
                updates["content"] = await card._renderContent();
                if (message.isOwner) {
                    message.update(updates);
                } else {
                    wireSocket.executeAsGM("updateSaveCardContent", message.uuid, updates);
                }

                if (failed) {
                    await card.concentrationEffect.delete();
                }
            }
            break;
        case "concentration-drop":
            if (card.actor.isOwner) {
                await card.concentrationEffect.delete();
            }
            break;
        default:
            break;
        }

        button.disabled = false;
    }

    static fromMessage(message) {
        const data = message.flags.wire;
        return new ConcentrationCard(fudgeToActor(fromUuid(data.actorUuid)), fromUuid(data.concentrationEffectUuid), { damage: data.damageAmount, dc: data.flatDc });
    }

    constructor(actor, concentrationEffect, requirement) {
        this.actor = actor;
        this.concentrationEffect = concentrationEffect;
        this.requirement = requirement
        this.damageAmount = requirement?.damage;
        this.flatDc = requirement?.dc;
    }

    get dc() {
        if (this.damageAmount !== undefined) {
            return Math.max(Math.floor(this.damageAmount / 2), 10);
        } else if (this.flatDc !== undefined) {
            return this.flatDc;
        } else {
            return 10;
        }
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
            isConcentrationCard: true,
            actorUuid: this.actor.uuid,
            concentrationEffectUuid: this.concentrationEffect.uuid,
            damageAmount: this.damageAmount,
            flatDc: this.flatDc
        };
    }

    async _renderContent() {
        const templateData = {
            actor: this.actor,
            token: getActorToken(this.actor),
            damageAmount: this.damageAmount,
            item: fromUuid(this.concentrationEffect.origin),
            dc: this.dc,
            result: this.result,
            isSuccess: this.result === "success" || this.result >= this.dc,
            isFailure: this.result === "failure" || this.result < this.dc
        };
        return await renderTemplate(ConcentrationCard.templateName, templateData);
    }

}