import { Activation } from "../activation.js";
import { Flow } from "../flow.js";
import { takeAnActionFlow } from "../flows/take-an-action.js";
import { makeUpdater } from "../updater-utility.js";
import { areAllied, areEnemies, fromUuid, getTokenTemplateIds, triggerConditions } from "../utils.js";

export function initCombatTurnConditionHooks() {
    Hooks.on("updateCombat", async (combat, change, options, userId) => {
        if (game.user.isGM) {
            const previousToken = canvas.tokens.get(game.combat.previous.tokenId);
            const previousCombatant = game.combat.turns.find(t => t.id === game.combat.previous.combatantId);
            const previousActor = previousCombatant?.actor;
    
            await handleTurn(previousActor, previousToken, false);
    
            const currentToken = canvas.tokens.get(game.combat.current.tokenId);
            const currentCombatant = game.combat.turns.find(t => t.id === game.combat.current.combatantId);
            const currentActor = currentCombatant.actor;
    
            await handleTurn(currentActor, currentToken, true);
        }
    });
}

async function handleTurn(actor, token, isStart) {
    // Target turn changes
    const handledTargetCondition = isStart ? "start-of-turn-target" : "end-of-turn-target";

    triggerConditions(actor, handledTargetCondition);

    // Caster turn changes
    const handledCasterCondition = isStart ? "start-of-turn-caster" : "end-of-turn-caster";

    actor.data.flags.wire?.turnUpdatedEffectUuids?.map(uuid => fromUuid(uuid)).filter(e => !e.isSuppressed).forEach(async effect => {
        const conditions = effect.data.flags.wire?.conditions?.filter(c => c.condition === handledCasterCondition) ?? [];
        await Promise.all(conditions.map(async condition => {
            const item = fromUuid(effect.data.origin);
            if (effect.parent instanceof CONFIG.Actor.documentClass) {
                const updater = makeUpdater(condition, effect, item);
                await updater?.process();
            }
        }));
    });

    // Area lingers
    const handledAreaCondition = isStart ? "starts-turn-inside-area" : "ends-turn-inside-area";
    const templateIds = getTokenTemplateIds(token);

    for (let templateId of templateIds) {
        const effectUuid = canvas.templates.get(templateId)?.data.flags.wire?.masterEffectUuid;
        const effect = fromUuid(effectUuid);
    
        if (effect && !effect.isSuppressed) {
            const conditions = effect.data.flags.wire?.conditions?.filter(c => c.condition.endsWith(handledAreaCondition)) ?? [];
            await Promise.all(conditions.map(async condition => {
                const item = fromUuid(effect.data.origin);

                let dispositionCheck = false;
                if (condition.condition.startsWith("ally") && areAllied(actor, item.actor)) { dispositionCheck = true; }
                else if (condition.condition.startsWith("enemy") && areEnemies(actor, item.actor)) { dispositionCheck = true; }
                else if (condition.condition.startsWith("creature")) { dispositionCheck = true; }

                if (dispositionCheck) {
                    const updater = makeUpdater(condition, effect, item, token.actor);
                    await updater?.process();
                }
            }));
        }
    }

    // Actions
    if (isStart) {
        actor.effects.filter(e => !e.isSuppressed).forEach(async effect => {
            const conditions = effect.data.flags.wire?.conditions?.filter(c => c.condition === "take-an-action") ?? [];
            await Promise.all(conditions.map(async condition => {
                const item = fromUuid(effect.data.origin);
                const flow = new Flow(item, "immediate", takeAnActionFlow, { allowMacro: false });
                await Activation.createConditionMessage(condition, item, effect, flow, { playerMessageOnly: item.actor.hasPlayerOwner });
            }));
        });
    }
}