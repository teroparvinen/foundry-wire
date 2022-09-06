import { fromUuid, fudgeToActor } from "./utils.js";
import { Activation } from "./activation.js";
import { DamageCard } from "./cards/damage-card.js";
import { runInQueue } from "./action-queue.js";

export let wireSocket = undefined;

export function setupSocket() {
    wireSocket = socketlib.registerModule("wire");
    wireSocket.register("activationUpdated", activationUpdated);
    wireSocket.register("refreshActivation", refreshActivation);
    wireSocket.register("updateMessage", updateMessage);
    wireSocket.register("scrollBottom", scrollBottom);
    wireSocket.register("runCustomUpdater", runCustomUpdater);
    wireSocket.register("createDamageCard", createDamageCard);
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

async function refreshActivation(messageUuid, data) {
    const message = fromUuid(messageUuid);

    if (message) {
        const originatorUserId = message.getFlag("wire", "originatorUserId");
        if (originatorUserId) {
            if (game.user.isGM && !message.isAuthor) {
                const gmMessageUuid = message.getFlag("wire", "gmMessageUuid");
                if (gmMessageUuid) {
                    const gmMessage = fromUuid(gmMessageUuid);
                    const activation = new Activation(gmMessage, data);
                    await activation._updateCard();
                }
            } else if (message.isAuthor || originatorUserId === game.user.id) {
                const activation = new Activation(message, data);
                await activation._updateCard();
            }
        }
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

async function runCustomUpdater(condition, effectUuid, details) {
    const effect = fromUuid(effectUuid);
    if (effect) {
        const item = fromUuid(effect.data.origin);

        if (item) {
            const flow = new Flow(item, "none");
            flow.evaluate();
            const updater = flow.customUpdaters[condition.update]
        
            if (updater) {
                const result = updater.fn(condition, effect, details);
                if (result instanceof Promise) {
                    await result;
                }
            }
        }
    }
}

async function createDamageCard(isPlayer, actorUuid, targetDamageData) {
    const actor = fromUuid(actorUuid);
    const targetDamage = targetDamageData.map(tdd => {
        return {
            actor: fudgeToActor(fromUuid(tdd.actorUuid)),
            token: fromUuid(tdd.tokenUuid)?.object,
            points: tdd.points
        }
    });

    const card = new DamageCard(isPlayer, actor, targetDamage);
    await card.make();
}
