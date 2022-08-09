import { makeUpdater } from "../make-updater.js";
import { fromUuid } from "../utils.js";

export function initCombatTurnConditionHooks() {
    Hooks.on("updateCombat", async (combat, change, options, userId) => {
        // change includes round when round changes, turn every time

        // const currentCombatant = game.combat.turns.find(t => t.id === game.combat.current.combatantId);
        // const currentActor = currentCombatant.actor;
        // console.log("CURRENT", currentActor.name);

        const previousCombatant = game.combat.turns.find(t => t.id === game.combat.previous.combatantId);
        const previousActor = previousCombatant?.actor;

        await handleTurn(previousActor, false);

        const currentCombatant = game.combat.turns.find(t => t.id === game.combat.current.combatantId);
        const currentActor = currentCombatant.actor;

        await handleTurn(currentActor, true);
    });
}

async function handleTurn(actor, isStart) {
    const handledTargetCondition = isStart ? "start-of-turn-target" : "end-of-turn-target";

    actor.effects.filter(e => !e.isSuppressed).forEach(async effect => {
        const conditions = effect.data.flags.wire?.conditions?.filter(c => c.condition === handledTargetCondition) ?? [];
        await Promise.all(conditions.map(async condition => {
            const item = fromUuid(effect.origin);
            const updater = makeUpdater(condition.update, effect, actor, item);
            await updater?.process();
        }));
    });

    const handledCasterCondition = isStart ? "start-of-turn-caster" : "end-of-turn-caster";

    actor.data.flags.wire?.turnUpdatedEffectUuids.map(uuid => fromUuid(uuid)).filter(e => !e.isSuppressed).forEach(async effect => {
        const conditions = effect.data.flags.wire?.conditions?.filter(c => c.condition === handledCasterCondition) ?? [];
        await Promise.all(conditions.map(async condition => {
            const item = fromUuid(effect.origin);
            const effectActor = effect.actor;
            const updater = makeUpdater(condition.update, effect, effectActor, item);
            await updater?.process();
        }));
    });
}