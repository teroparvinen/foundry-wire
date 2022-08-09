import { fromUuid } from "./utils.js";
import { Activation } from "./activation.js";

export let wireSocket = undefined;

export function setupSocket() {
    wireSocket = socketlib.registerModule("wire");
    wireSocket.register("activationUpdated", activationUpdated);
    wireSocket.register("updateMessage", updateMessage);
}

async function activationUpdated(messageUuid) {
    const message = fromUuid(messageUuid);

    const originatorUuid = message.getFlag("wire", "originatorUserId");
    if (originatorUuid) {
        if (game.user.isGM && !message.isAuthor) {
            const gmMessageUuid = message.getFlag("wire", "gmMessageUuid");
            if (gmMessageUuid) {
                const gmMessage = fromUuid(gmMessageUuid);
                const activation = new Activation(gmMessage);
                await activation.step();
                await activation.updateCard();
            }
        } else if (message.isAuthor) {
            const activation = new Activation(message);
            await activation.step();
            await activation.updateCard();
        }
    }
}

async function updateMessage(messageUuid, data) {
    const message = fromUuid(messageUuid);
    await message.setFlag("wire", "activation", data);

    const activation = new Activation(message);
    await activation.step();
    await activation.updateCard();
}
