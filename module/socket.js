import { fromUuid } from "./utils.js";
import { Activation } from "./activation.js";

export let wireSocket = undefined;

export function setupSocket() {
    wireSocket = socketlib.registerModule("wire");
    wireSocket.register("activationUpdated", activationUpdated);
    wireSocket.register("updateMessage", updateMessage);
    wireSocket.register("scrollBottom", scrollBottom);
}

async function activationUpdated(messageUuid) {
    const message = fromUuid(messageUuid);

    if (message) {
        const originatorUserId = message.getFlag("wire", "originatorUserId");
        if (originatorUserId) {
            if (game.user.isGM && !message.isAuthor) {
                const gmMessageUuid = message.getFlag("wire", "gmMessageUuid");
                if (gmMessageUuid) {
                    const gmMessage = fromUuid(gmMessageUuid);
                    const activation = new Activation(gmMessage);
                    await activation.step();
                    await activation.updateCard();
                }
            } else if (message.isAuthor || originatorUserId === game.user.id) {
                const activation = new Activation(message);
                await activation.step();
                await activation.updateCard();
            }
        }
    }
}

async function updateMessage(messageUuid, data) {
    const message = fromUuid(messageUuid);
    if (message) {
        await message.setFlag("wire", "activation", data);

        const activation = new Activation(message);
        await activation.step();
        await activation.updateCard();
    }
}

function scrollBottom() {
    ui.chat.scrollBottom();
}