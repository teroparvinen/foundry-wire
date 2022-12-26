
export function setupDurations() {
    Hooks.on("updateWorldTime", async (worldTime, dt) => {
        if (game.user.isGM) {
            checkTimedDurations(worldTime);
        }
    });

    Hooks.on("canvasReady", async (canvas) => {
        if (game.user.isGM) {
            checkTimedDurations(game.time.worldTime);
        }
    });
}

export async function checkCombatDurations(combat) {
    const actorSet = new Set();
    const canvasActors = canvas.tokens.objects.children.map(t => t.actor);
    const combatActors = combat.turns.map(t => t.actor);

    [...canvasActors, ...combatActors].forEach(a => actorSet.add(a));
    const effects = [...actorSet].flatMap(actor => actor.effects.filter(e => e.isTemporary && e.duration?.type === "turns"));
    const expiredEffects = effects.filter(effect => {
        const dur = effect.duration;
        let expiryRound = dur.startRound + dur.rounds;
        let expiryTurn = dur.startTurn + dur.turns;
        while (expiryTurn >= combat.turns.length) {
            expiryRound += 1;
            expiryTurn -= combat.turns.length;
        }

        return combat.round >= expiryRound && combat.turn >= expiryTurn;
    });

    await Promise.all(expiredEffects.map(e => e.delete()));
}

async function checkTimedDurations(worldTime) {
    const actorSet = new Set();
    const canvasActors = canvas.tokens.objects.children.map(t => t.actor);
    const combatActors = game.combat?.turns.map(t => t.actor) || [];

    [...canvasActors, ...combatActors].forEach(a => actorSet.add(a));
    const effects = [...actorSet].flatMap(actor => actor.effects.filter(e => e.isTemporary && e.duration?.type === "seconds"));
    const expiredEffects = effects.filter(effect => {
        const dur = effect.duration;
        return worldTime >= dur.startTime + dur.seconds;
    });

    await Promise.all(expiredEffects.map(e => e.delete()));
}
