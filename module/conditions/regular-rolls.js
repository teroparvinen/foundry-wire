import { triggerConditions } from "../utils.js";

export function initRegularRollHooks() {
    if (game.modules.get('dice-so-nice')?.active) {
        Hooks.on("diceSoNiceRollComplete", messageId => {
            const message = game.messages.get(messageId);
            handleRegularMessageRoll(message);            
        });
    } else {
        Hooks.on("createChatMessage", message => {
            handleRegularMessageRoll(message);            
        });
    }
}

function handleRegularMessageRoll(message) {
    const rollType = message.flags.dnd5e?.roll?.type;
    if (message.isRoll) {
        const speaker = message.speaker;
        const actor = game.scenes.get(speaker.scene)?.tokens.get(speaker.token)?.object.actor;
        if (actor) {
            if (rollType === "save") {
                triggerConditions(actor, "saving-throw-completed");
            } else if (rollType === "skill") {
                triggerConditions(actor, "skill-check-completed");
            } else if (rollType === "ability") {
                triggerConditions(actor, "ability-check-completed");
            }
        }
    }
}
