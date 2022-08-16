import { Activation } from "./activation.js";
import { DamageCard } from "./cards/damage-card.js";
import { ItemCard } from "./cards/item-card.js";
import { getWireFlags } from "./game/effect-flags.js";
import { fromUuid, isActorEffect } from "./utils.js";

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
                speaker: message.data.speaker,
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
        const isExplicitlyHidden = message.getFlag("wire", "isHidden");
        if (shouldHidePlayerOriginated || shouldHidePlayerView || isExplicitlyHidden) {
            html[0].classList.add("wire-gm-hide");
        }
    });

    Hooks.on("deleteActiveEffect", async (effect, options, user) => {
        if (game.user.isGM && isActorEffect(effect)) {
            // Master effect deleted
            if (effect.getFlag("wire", "isMasterEffect")) {
                const templateUuid = effect.getFlag("wire", "templateUuid");
                if (templateUuid) {
                    const template = fromUuid(templateUuid);
                    await template?.delete();
                }
    
                const childEffectUuids = effect.getFlag("wire", "childEffectUuids");
                if (childEffectUuids && childEffectUuids.length) {
                    for (let uuid of childEffectUuids) {
                        await fromUuid(uuid)?.delete();
                    }
                }
            }

            // Turn update linked effect deleted
            const casterUuid = effect.getFlag("wire", "castingActorUuid");
            if (casterUuid) {
                const caster = fromUuid(casterUuid);
                const effectUuids = caster.data.flags.wire?.turnUpdatedEffectUuids.filter(uuid => uuid !== effect.uuid);
                caster.setFlag("wire", "turnUpdatedEffectUuids", effectUuids);
            }
        }
    });

    Hooks.on("deleteMeasuredTemplate", (template, options, user) => {
        if (template.author === game.user) {
            const attachedTokenId = template.getFlag("wire", "attachedTokenId");
            if (attachedTokenId) {
                const token = canvas.tokens.get(attachedTokenId);
                token.document.unsetFlag("wire", "attachedTemplateId");
            }
        }
    });

    Hooks.on("updateToken", async (tokenDoc, change, options, userId) => {
        if (change.x || change.y) {
            const templateId = await tokenDoc.getFlag("wire", "attachedTemplateId");
            const template = canvas.templates.get(templateId);
            if (template && template.document.author === game.user) {
                const update = tokenDoc.object.getCenter(tokenDoc.data.x, tokenDoc.data.y);
                await template.document.update(update);
            }
        }
    });

    Hooks.on("preUpdateActor", async (actor, change, options, userId) => {
        const hpUpdate = getProperty(change, "data.attributes.hp.value");
        if (hpUpdate !== undefined) {
            const maxHp = actor.data.data.attributes.hp.max;
            const woundedThreshold = Math.floor(0.5 * maxHp);

            const isDamaged = hpUpdate < maxHp;
            const isWounded = hpUpdate <= woundedThreshold;
            const isAtZero = hpUpdate == 0;

            const needsDamaged = isDamaged && !isAtZero && !isWounded;
            const needsWounded = isWounded && !isAtZero;
            const needsUnconscious = actor.hasPlayerOwner && isAtZero;
            const needsDead = !actor.hasPlayerOwner && isAtZero;

            const ceApi = game.dfreds?.effectInterface;

            if (ceApi) {
                const damagedExists = ceApi.findEffectByName("Damaged");

                const hasDamaged = damagedExists && ceApi.hasEffectApplied("Damaged", actor.uuid);
                const hasWounded = ceApi.hasEffectApplied("Wounded", actor.uuid);
                const hasUnconscious = ceApi.hasEffectApplied("Unconscious", actor.uuid);
                const hasDead = ceApi.hasEffectApplied("Dead", actor.uuid);

                if (damagedExists && (needsDamaged != hasDamaged)) { await ceApi.toggleEffect("Damaged", { uuids: [actor.uuid] }); }
                if (needsWounded != hasWounded) { await ceApi.toggleEffect("Wounded", { uuids: [actor.uuid] }); }
                if (needsUnconscious != hasUnconscious) { await ceApi.toggleEffect("Unconscious", { uuids: [actor.uuid] }); }
                if (needsDead != hasDead) {
                    await ceApi.toggleEffect("Dead", { uuids: [actor.uuid], overlay: true });
                    
                    const combatant = actor.token ? game.combat?.getCombatantByToken(actor.token.id) : game.combat?.getCombatantByActor(actor.id);
                    await combatant.update({ defeated: needsDead });
                }
            }
        }
    });

    Hooks.on("updateCombat", async (combat, change, options, userId) => {
        if (game.user.isGM) {
            const combatant = combat.combatants.get(combat.current.combatantId);
            if (combatant?.isNPC) {
                combatant.token?.object?.control();
                canvas.animatePan({ x: combatant.token?._object?.x, y: combatant.token?._object?.y })
            }
        }
    });

    Hooks.on("ready", () => {
        if (game.modules.get("dae")?.active) {
            DAE.addAutoFields(getWireFlags());
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
