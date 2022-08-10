import { makeUpdater } from "../make-updater.js";
import { fromUuid, getTokenTemplateIds } from "../utils.js";

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

    actor.effects.filter(e => !e.isSuppressed).forEach(async effect => {
        const conditions = effect.data.flags.wire?.conditions?.filter(c => c.condition === handledTargetCondition) ?? [];
        await Promise.all(conditions.map(async condition => {
            const item = fromUuid(effect.data.origin);
            const updater = makeUpdater(condition.update, effect, actor, item);
            await updater?.process(effect.parent);
        }));
    });

    // Caster turn changes
    const handledCasterCondition = isStart ? "start-of-turn-caster" : "end-of-turn-caster";

    actor.data.flags.wire?.turnUpdatedEffectUuids.map(uuid => fromUuid(uuid)).filter(e => !e.isSuppressed).forEach(async effect => {
        const conditions = effect.data.flags.wire?.conditions?.filter(c => c.condition === handledCasterCondition) ?? [];
        await Promise.all(conditions.map(async condition => {
            const item = fromUuid(effect.data.origin);
            if (effect.parent instanceof CONFIG.Actor.documentClass) {
                const effectActor = effect.parent;
                const updater = makeUpdater(condition.update, effect, effectActor, item);
                await updater?.process(effect.parent);
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
            const conditions = effect.data.flags.wire?.conditions?.filter(c => c.condition === handledAreaCondition) ?? [];
            await Promise.all(conditions.map(async condition => {
                const item = fromUuid(effect.data.origin);
                const updater = makeUpdater(condition.update, effect, token.actor, item);
                await updater?.process(token.actor);
            }));
        }
    }
}