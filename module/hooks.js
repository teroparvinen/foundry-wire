import { Activation } from "./activation.js";
import { DamageCard } from "./cards/damage-card.js";
import { ItemCard } from "./cards/item-card.js";
import { fromUuid } from "./utils.js";

export function initHooks() {
    Hooks.on("renderChatLog", (app, html, data) => {
         ItemCard.activateListeners(html)
         DamageCard.activateListeners(html);
    });
    Hooks.on("renderChatPopout", (app, html, data) => ItemCard.activateListeners(html));

    Hooks.on("createChatMessage", async (message, options, user) => {
        if (game.user.isGM && !message.isAuthor && message.getFlag("wire", "originatorUserId")) {
            const gmMessageData = {
                content: message.data.content,
                flags: foundry.utils.mergeObject(message.data.flags, { "wire.isGmView": true }),
                flavor: message.data.flavor,
                user: game.user.id,
                whisper: [game.user.id]
            };
            const gmMessage = await ChatMessage.create(gmMessageData);

            if (gmMessage) {
                const activation = await Activation.initializeGmMessage(gmMessage, message);
                await activation.updateCard();
            }
        }
    });

    Hooks.on("deleteChatMessage", async (message, options, user) => {
        if (game.user.isGM && message.getFlag("wire", "originatorUserId")) {
            await removeLinkedMessage(message.getFlag("wire", "masterMessageUuid"));
            await removeLinkedMessage(message.getFlag("wire", "gmMessageUuid"));
            await removeLinkedMessage(message.getFlag("wire", "playerMessageUuid"));
        }
    });

    Hooks.on("renderChatMessage", async (message, html, data) => {
        const shouldHidePlayerOriginated = game.user.isGM && !message.isAuthor && message.getFlag("wire", "originatorUserId");
        const shouldHidePlayerView = game.user.isGM && message.getFlag("wire", "isPlayerView");
        if (shouldHidePlayerOriginated || shouldHidePlayerView) {
            html[0].classList.add("wire-gm-hide");
        }
    });

    
    Hooks.on("deleteActiveEffect", async (effect, options, user) => {
        if (game.user.isGM) {
            if (effect.getFlag("wire", "isMasterEffect")) {
                const templateUuid = effect.getFlag("wire", "templateUuid");
                if (templateUuid) {
                    await fromUuid(templateUuid).delete();
                }
    
                const childEffectUuids = effect.getFlag("wire", "childEffectUuids");
                if (childEffectUuids && childEffectUuids.length) {
                    for (let uuid of childEffectUuids) {
                        await fromUuid(uuid)?.delete();
                    }
                }
            }

            const casterUuid = effect.getFlag("wire", "castingActorUuid");
            if (casterUuid) {
                const caster = fromUuid(casterUuid);
                const effectUuids = caster.flags.wire?.turnUpdatedEffectUuids.filter(uuid => uuid !== effect.uuid);
                caster.setFlag("wire", "turnUpdatedEffectUuids", effectUuids);
            }
        }
    });

}

// Jump some hoops to safely clear linked messages even when clearing the chat log
const requestProcessRemovalQueue = debounce(processRemovalQueue, 100);
let removeQueue = [];

async function removeLinkedMessage(uuid) {
    if (!removeQueue.includes(uuid)) {
        removeQueue.push(uuid);
        requestProcessRemovalQueue();
    }
}

async function processRemovalQueue() {
    for (let uuid of removeQueue) {
        if (uuid) {
            const msg = fromUuid(uuid);
            if (msg) {
                await msg.update({ 'flags.wire': {} });
                await msg.delete();
            }
        }
    }
    removeQueue = [];
}
