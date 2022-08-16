import { makeUpdater } from "./updater-utility.js";

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

export function effectDurationFromItemDuration(itemDuration, inActorInCombat) {
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
    const inCombat = !!game.combat;

    if (typeof timeMultipliers[itemDuration.units] === "undefined") {
        return {};
    }

    const seconds = timeMultipliers[itemDuration.units] * itemDuration.value;
    const rounds = itemDuration.units === "round" ? itemDuration.value : 0;
    const turns = itemDuration.units === "turn" ? itemDurationValue : 0;
    const startTime = game.time.worldTime;
    const startRound = game.combat?.round;
    const startTurn = game.combat?.turn;

    if (isDurationCombatTime) {
        if (inCombat) {
            return { rounds, turns, startRound, startTurn };
        } else {
            return { seconds: rounds * roundTime, startTime };
        }
    } else {
        if (inCombat) {
            return { rounds: Math.floor(seconds / roundTime), turns: 0, startRound, startTurn };
        } else {
            return { seconds, startTime }
        }
    }
}

export function checkEffectDurationOverride(duration, effect) {
    const roundTime = CONFIG.time.roundTime;

    const effectDuration = effect.data.duration;
    const isCombatTime = effectDuration.rounds || effectDuration.turns;
    const startTime = game.time.worldTime;
    const startRound = game.combat?.round;
    const startTurn = game.combat?.turn;

    if (effectDuration?.turns || effectDuration?.rounds) {
        const rounds = effectDuration.rounds;
        const turns = effectDuration.turns;
        if (isCombatTime) {
            return { rounds, turns, startRound, startTurn };
        } else {
            return { seconds: rounds * roundTime, startTime };
        }
    } else if (effectDuration?.seconds) {
        const seconds = effectDuration.seconds;
        if (isCombatTime) {
            return { rounds: Math.floor(seconds / roundTime), turns: 0, startRound, startTurn };
        } else {
            return { seconds, startTime }
        }
    }

    return duration;
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
    const conditions = effect.data.flags.wire?.conditions;
    if (conditions) {
        return duplicate(conditions);
    }
}

export function copyEffectDuration(effect) {
    const { seconds, startTime, rounds, turns, startRound, startTurn } = effect.data.duration;
    return { seconds, startTime, rounds, turns, startRound, startTurn };
}

export function isCasterDependentEffect(effect) {
    return effect.data.flags.wire?.conditions?.some(c => ["start-of-turn-caster", "end-of-turn-caster"].includes(c.condition));
}

export function i18n(...args) {
    if (args.length) {
        return game.i18n.format(...args);
    }
    return game.i18n.localize(...args);
}

export function getTokenSquarePositions(token) {
    let tokenPositions = [];
    if (token.data.width === 1 && token.data.height === 1) {
        tokenPositions.push(`${token.data.x}.${token.data.y}`);
    } else {
        const gs = canvas.grid.size;
        for (let x = 0; x < token.data.width; x++) {
            for (let y = 0; y < token.data.height; y++) {
                tokenPositions.push(`${token.data.x + gs * x}.${token.data.y + gs * y}`);
            }
        }
    }
    return tokenPositions;
}

export function getTokenTemplateIds(token, requireAll = false) {
    const tokenPositions = getTokenSquarePositions(token);

    return Object.entries(canvas.grid.highlightLayers)
        .filter(e => e[0].startsWith("Template."))
        .filter(e => {
            if (requireAll) {
                return tokenPositions.every(p => e[1].positions.has(p));
            } else {
                return tokenPositions.some(p => e[1].positions.has(p));
            }
        })
        .map(e => e[0].substring(9));
}

export function getTemplateTokenUuids(template, requireAll = true) {
    const templatePositions = canvas.grid.highlightLayers[`Template.${template.id}`]?.positions;
    if (templatePositions) {
        const tokens = canvas.tokens.objects.children;
        return tokens
            .filter(t => t.isVisible)
            .filter(t => {
                if (requireAll) {
                    return getTokenSquarePositions(t).every(p => templatePositions.has(p));
                } else {
                    return getTokenSquarePositions(t).some(p => templatePositions.has(p));
                }
            })
            .map(t => t.document.uuid);
    }
    return [];
}

const AsyncFunction = Object.getPrototypeOf(async function(){}).constructor;

export async function runAndAwait(fn, ...args) {
    if (fn.constructor === AsyncFunction) {
        return await fn(...args);
    } else if (fn.constructor === Function) {
        return fn(...args);
    }
}

export async function triggerConditions(actor, condition, externalTargetActor = null) {
    actor.effects.filter(e => !e.isSuppressed).forEach(async effect => {
        const conditions = effect.data.flags.wire?.conditions?.filter(c => c.condition === condition) ?? [];
        for (let condition of conditions) {
            const item = fromUuid(effect.data.origin);
            const updater = makeUpdater(condition, effect, item, externalTargetActor);
            await updater?.process();
        }
    });
}

export function getDisposition(actor) {
    // Without a token, assume players are friendly, non-players with character sheets are neutral and npc sheet means enemy
    const disp = getActorToken(actor)?.data.disposition;
    const tokenDisposition = typeof disp === "number" ? disp : undefined;
    const assumedDisposition = actor.hasPlayerOwner ? 1 : (actor.type === "npc" ? -1 : 0);
    return tokenDisposition || assumedDisposition;
}

export function areAllied(actor1, actor2) {
    const disp1 = getDisposition(actor1);
    const disp2 = getDisposition(actor2);

    return disp1 === disp2;
}

export function areEnemies(actor1, actor2) {
    const disp1 = getDisposition(actor1);
    const disp2 = getDisposition(actor2);

    return disp1 === -disp2;
}

export function isCastersTurn(item) {
    const actor = item.actor;
    if (game.combat) {
        const combatant = game.combat.getCombatantByActor(actor.id);
        return game.combat.current.combatantId === combatant.id;
    } else {
        // Assume out of combat to be the caster's to operate freely
        return true;
    }
}

export function setTemplateTargeting(state) {
    if (game.modules.get("df-templates")?.active) {
        game.settings.set("df-templates", "template-targeting-toggle", state);
    }
}

export function damagePartMatchesVariant(formula, variant) {
    const result = formula.match(RollTerm.FLAVOR_REGEXP);
    return (result && result.length && result[0].toLowerCase() === `[${variant.toLowerCase()}]`);
}

export function isActorEffect(effect) {
    return effect.parent && effect.parent instanceof CONFIG.Actor.documentClass;
}

export function isItemEffect(effect) {
    return effect.parent && effect.parent instanceof CONFIG.Item.documentClass;
}
