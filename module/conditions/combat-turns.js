import { Activation } from "../activation.js";
import { Flow } from "../flow.js";
import { takeAnActionFlow } from "../flows/take-an-action.js";
import { makeUpdater } from "../updater-utility.js";
import { areAllied, areAreaConditionsBlockedForActor, areEnemies, fromUuid, getTokenTemplateIds, isEffectEnabled, triggerConditions } from "../utils.js";

export async function updateCombatTurnConditions() {
    const previousToken = canvas.tokens.get(game.combat.previous.tokenId);
    const previousCombatant = game.combat.turns.find(t => t.id === game.combat.previous.combatantId);
    const previousActor = previousCombatant?.actor;

    await handleTurn(previousActor, previousToken, false);

    const currentToken = canvas.tokens.get(game.combat.current.tokenId);
    const currentCombatant = game.combat.turns.find(t => t.id === game.combat.current.combatantId);
    const currentActor = currentCombatant.actor;

    await handleTurn(currentActor, currentToken, true);
}

async function handleTurn(actor, token, isStart) {
    // Target turn changes
    const handledTargetCondition = isStart ? "start-of-turn-target" : "end-of-turn-target";

    triggerConditions(actor, handledTargetCondition);

    // Caster turn changes
    const handledCasterCondition = isStart ? "start-of-turn-caster" : "end-of-turn-caster";

    actor.data.flags.wire?.turnUpdatedEffectUuids?.map(uuid => fromUuid(uuid)).filter(e => isEffectEnabled(e)).forEach(async effect => {
        const conditions = effect.data.flags.wire?.conditions?.filter(c => c.condition === handledCasterCondition) ?? [];
        for (let condition of conditions) {
            const item = fromUuid(effect.data.origin);
            if (effect.parent instanceof CONFIG.Actor.documentClass) {
                const updater = makeUpdater(condition, effect, item);
                await updater?.process();
            }
        }
    });

    // Area lingers
    const handledAreaCondition = isStart ? "starts-turn-inside-area" : "ends-turn-inside-area";
    const templateIds = getTokenTemplateIds(token);

    for (let templateId of templateIds) {
        const effectUuid = canvas.templates.get(templateId)?.data.flags.wire?.masterEffectUuid;
        const effect = fromUuid(effectUuid);
        const item = fromUuid(effect.data.origin);
    
        if (effect && isEffectEnabled(effect) && !areAreaConditionsBlockedForActor(item, actor)) {
            const conditions = effect.data.flags.wire?.conditions?.filter(c => c.condition.endsWith(handledAreaCondition)) ?? [];
            for (let condition of conditions) {
                let dispositionCheck = false;
                if (condition.condition.startsWith("ally") && areAllied(actor, item.actor)) { dispositionCheck = true; }
                else if (condition.condition.startsWith("enemy") && areEnemies(actor, item.actor)) { dispositionCheck = true; }
                else if (condition.condition.startsWith("creature")) { dispositionCheck = true; }

                if (dispositionCheck) {
                    const updater = makeUpdater(condition, effect, item, token.actor);
                    await updater?.process();
                }
            }
        }
    }

    // Actions
    if (isStart) {
        actor.effects.filter(e => isEffectEnabled(e)).forEach(async effect => {
            const conditions = effect.data.flags.wire?.conditions?.filter(c => c.condition === "take-an-action") ?? [];
            for (let condition of conditions) {
                const item = fromUuid(effect.data.origin);
                const flow = new Flow(item, "immediate", takeAnActionFlow, { allowMacro: false, isConditionTriggered: true });
                await Activation._createConditionMessage(condition, item, effect, flow, { 
                    revealToPlayers: effect.parent.hasPlayerOwner, 
                    suppressPlayerMessage: !effect.parent.hasPlayerOwner,
                    speakerIsEffectOwner: true
                });
            }
        });
        // actor.effects.filter(e => isEffectEnabled(e)).forEach(async effect => {
        //     const conditions = effect.data.flags.wire?.conditions?.filter(c => c.condition === "take-a-reaction") ?? [];
        //     for (let condition of conditions) {
        //         const item = fromUuid(effect.data.origin);
        //         const flow = new Flow(item, "immediate", takeAnActionFlow, { allowMacro: false, isConditionTriggered: true });
        //         await Activation._createConditionMessage(condition, item, effect, flow, {
        //             revealToPlayers: item.actor.hasPlayerOwner,
        //             suppressPlayerMessage: !item.actor.hasPlayerOwner
        //         });
        //     }
        // });
    }
}