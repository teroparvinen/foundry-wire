import { fromUuid, fudgeToActor } from "./utils.js";
import { Activation } from "./activation.js";
import { DamageCard } from "./cards/damage-card.js";
import { runInQueue } from "./action-queue.js";
import { Flow } from "./flow.js";
import { createChildEffects, removeChildEffects } from "./game/active-effects.js";

export let wireSocket = undefined;

export function setupSocket() {
    wireSocket = socketlib.registerModule("wire");
    wireSocket.register("activationUpdated", activationUpdated);
    wireSocket.register("activationTemplateCreated", activationTemplateCreated);
    wireSocket.register("refreshActivation", refreshActivation);
    wireSocket.register("registerSave", registerSave);
    wireSocket.register("updateMessage", updateMessage);
    wireSocket.register("scrollBottom", scrollBottom);
    wireSocket.register("runCustomUpdater", runCustomUpdater);
    wireSocket.register("createDamageCard", createDamageCard);
    wireSocket.register("refreshDamageCard", refreshDamageCard);
    wireSocket.register("updateDamageCardEntry", updateDamageCardEntry);
    wireSocket.register("updateSaveCardContent", updateSaveCardContent);
    wireSocket.register("requestRemoveChildEffects", requestRemoveChildEffects);
    wireSocket.register("requestCreateChildEffects", requestCreateChildEffects);
}

async function activationUpdated(messageUuid) {
    await runInQueue(async () => {
        const message = fromUuid(messageUuid);

        if (message) {
            const originatorUserId = message.getFlag("wire", "originatorUserId");
            if (originatorUserId) {
                if (game.user.isGM && !message.isAuthor) {
                    const gmMessageUuid = message.getFlag("wire", "gmMessageUuid");
                    if (gmMessageUuid) {
                        const gmMessage = fromUuid(gmMessageUuid);
                        const activation = new Activation(gmMessage);
                        activation._step();
                    }
                } else if (message.isAuthor || originatorUserId === game.user.id) {
                    const activation = new Activation(message);
                    activation._step();
                }
            }
        }
    });
}

async function activationTemplateCreated(templateUuid) {
    const templateDoc = fromUuid(templateUuid);
    if (templateDoc) {
        Hooks.callAll("createActivationMeasuredTemplate", templateDoc);
    }
}

async function refreshActivation(messageUuid, updateCard) {
    const message = fromUuid(messageUuid);

    if (message) {
        const originatorUserId = message.getFlag("wire", "originatorUserId");
        if (originatorUserId) {
            if (game.user.isGM && !message.isAuthor) {
                const gmMessageUuid = message.getFlag("wire", "gmMessageUuid");
                if (gmMessageUuid) {
                    const gmMessage = fromUuid(gmMessageUuid);
                    const activation = new Activation(gmMessage);
                    await activation._updateCard();
                }
            } else if (message.isAuthor || originatorUserId === game.user.id) {
                const activation = new Activation(message);
                if (updateCard) await activation._updateCard();
            }
        }
    }
}

async function registerSave(messageUuid, saveData, interactive) {
    const message = fromUuid(messageUuid);
    if (message) {
        const activation = new Activation(message);
        await activation._applySaveAsGM(saveData, interactive);
    }
}

async function updateMessage(messageUuid, data) {
    const message = fromUuid(messageUuid);
    if (message) {
        await message.setFlag("wire", "activation", data);

        const activation = new Activation(message);
        await activation._step();
        await activation._updateCard();
    }
}

function scrollBottom() {
    ui.chat.scrollBottom();
}

async function runCustomUpdater(condition, itemUuid, effectUuid, details) {
    const item = fromUuid(itemUuid);
    const effect = fromUuid(effectUuid);
    if (effect) {
        const item = fromUuid(effect.origin);

        if (item) {
            const flow = new Flow(item, "none");
            flow.evaluate();
            const updater = flow.customUpdaters[condition.update]
        
            if (updater) {
                const result = updater.fn(condition, item, effect, details);
                if (result instanceof Promise) {
                    return await result;
                }
                return result;
            }
        }
    }
}

async function createDamageCard(actorUuid, targetDamageData) {
    const actor = fromUuid(actorUuid);
    const targetDamage = targetDamageData.map(tdd => {
        return {
            actor: fudgeToActor(fromUuid(tdd.actorUuid)),
            token: fromUuid(tdd.tokenUuid)?.object,
            points: tdd.points
        }
    });

    const card = await DamageCard.make(actor, targetDamage);
    return card.message.uuid;
}

async function refreshDamageCard(messageUuid) {
    const message = fromUuid(messageUuid);
    if (message) {
        const card = new DamageCard(message);
        await card.refreshCard();
    }
}

async function updateDamageCardEntry(messageUuid, actorUuid, update) {
    const message = fromUuid(messageUuid);
    const actor = fromUuid(actorUuid);
    if (message && actor) {
        const card = new DamageCard(message);
        await card.updateActorEntry(actor, update);
    }
}

async function updateSaveCardContent(messageUuid, updates) {
    const message = fromUuid(messageUuid);
    if (message && (message.flags.wire?.isConcentrationCard || message.flags.wire?.isDeathSaveCard)) {
        message.update(updates);
    }
}

async function requestRemoveChildEffects(effectUuid) {
    const effect = fromUuid(effectUuid);
    if (effect) {
        await removeChildEffects(effect);
    }
}

async function requestCreateChildEffects(masterEffectUuid, applicationType, targetUuid) {
    const masterEffect = fromUuid(masterEffectUuid);
    const target = fromUuid(targetUuid);

    if (masterEffect && target) {
        await createChildEffects(masterEffect, applicationType, fudgeToActor(target));
    }
}