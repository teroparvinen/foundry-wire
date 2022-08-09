export function fromUuid(uuid) {
    if (!uuid || uuid === '') return null;
    let parts = uuid.split('.');
    let doc;

    const [docName, docId] = parts.slice(0, 2);
    parts = parts.slice(2);
    const collection = CONFIG[docName]?.collection.instance;
    if (!collection) return null;
    doc = collection.get(docId);

    // Embedded Documents
    while (doc && parts.length > 1) {
        const [embeddedName, embeddedId] = parts.slice(0, 2);
        doc = doc.getEmbeddedDocument(embeddedName, embeddedId);
        parts = parts.slice(2);
    }
    return doc || null;
}

export function isInCombat(actor) {
    return (game.combat?.turns.some(combatant => combatant.actor?.id === actor.id));
}

export function effectDurationFromItemDuration(itemDuration, inCombat) {
    if (!itemDuration) { return {}; }

    const timeMultipliers = {
        turn: 0,
        round: 6,
        minute: 60,
        hour: 60 * 60,
        day: 60 * 60 * 24,
        month: 60 * 60 * 24 * 30,
        year: 60 * 60 * 24 * 365
    }

    const roundTime = CONFIG.time.roundTime;
    const isDurationCombatTime = itemDuration.units === "round" || itemDuration.units === "turn";
    const durationInSeconds = itemDuration.value * timeMultipliers[itemDuration.units];
    const durationInRounds = Math.floor(durationInSeconds / roundTime);
    const durationInTurns = itemDuration.units === "turn" ? itemDuration.value : 0;

    const result = {
        seconds: durationInSeconds,
        startTime: game.time.worldTime,
    };
    if (inCombat || isDurationCombatTime) {
        result.rounds = durationInRounds;
        result.turns = durationInTurns;
        result.startRound = game.combat?.round;
        result.startTurn = game.combat?.turn;
    }

    return result;

    // if (DAE) {
    //     const convertedDuration = DAE.convertDuration(itemDuration, inCombat);
    //     if (convertedDuration?.type === "seconds") {
    //         return { seconds: convertedDuration.seconds, startTime: game.time.worldTime };
    //     }
    //     else if (convertedDuration?.type === "turns") {
    //         return {
    //             rounds: convertedDuration.rounds,
    //             turns: convertedDuration.turns,
    //             startRound: game.combat?.round,
    //             startTurn: game.combat?.turn
    //         };
    //     }
    // }
    // return {};
}

export function localizedWarning(key) {
    ui.notifications?.warn(game.i18n.localize(key));
    return false; // For return value chaning
}

export function getActorToken(actor) {
    return actor.token ? actor.token.object : actor.getActiveTokens().find(t => t)
}

export function fudgeToActor(candidate) {
    // Token actors have the same UUID for the token document and the actor, try to get the actor
    if (candidate instanceof CONFIG.Actor.documentClass) {
        return candidate;
    } else if (candidate instanceof CONFIG.Token.documentClass) {
        return candidate.object.actor;
    } else {
        console.warn('Expected', candidate, 'to be actor');
    }
}

export function getAttackRollResultType(roll) {
    if (roll) {
        const die = roll.dice[0];
        if (die.faces == 20 && die.number == 1) {
            const value = die.total;
            if (die.total >= die.options.critical) return "critical";
            if (die.total <= die.options.fumble) return "fumble";
        }
    }
}

export function getSpeaker(actor) {
    const speaker = ChatMessage.getSpeaker({ actor });
    const token = getActorToken(actor);
    if (token)
        speaker.alias = token.name;
    return speaker;
}

export function copyEffectChanges(effect) {
    return effect.data.changes.map(c => {
        const { key, mode, priority, value } = c;
        return { key, mode, priority, value };
    })
}

export function copyConditions(effect) {
    return duplicate(effect.data.flags.wire?.conditions);
}

export function copyEffectDuration(effect) {
    const { seconds, startTime, rounds, turns, startRound, startTurn } = effect.data.duration;
    return { seconds, startTime, rounds, turns, startRound, startTurn };
}

export function isCasterDependentEffect(effect) {
    return effect.data.flags.wire.conditions.some(c => ["start-of-turn-caster", "end-of-turn-caster"].includes(c.condition));
}

export function i18n(...args) {
    return game.i18n.localize(...args);
}
