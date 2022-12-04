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

    const effectDuration = effect.duration;
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
        if (die.faces == 20) {
            const value = die.total;
            if (die.total >= die.options.critical) return "critical";
            if (die.total <= die.options.fumble) return "fumble";
        }
    }
}

export function getSpeaker(actor) {
    if (actor) {
        const speaker = ChatMessage.getSpeaker({ actor });
        const token = getActorToken(actor);
        if (token)
            speaker.alias = token.name;
        return speaker;
    }
}

export function copyEffectChanges(effect) {
    return effect.changes.map(c => {
        const { key, mode, priority, value } = c;
        return { key, mode, priority, value };
    })
}

export function substituteEffectConfig(actor, config, changes) {
    const rollData = actor.getRollData();
    rollData.config = config;
    return changes.map(c => {
        return {
            key: c.key,
            mode: c.mode,
            priority: c.priority,
            value: Roll.replaceFormulaData(c.value, rollData)
        };
    });
}

export function copyConditions(effect) {
    const conditions = effect.flags.wire?.conditions;
    if (conditions) {
        return duplicate(conditions);
    }
}

export function copyEffectDuration(effect) {
    const { seconds, startTime, rounds, turns, startRound, startTurn } = effect.duration;
    return { seconds, startTime, rounds, turns, startRound, startTurn };
}

export function isCasterDependentEffect(effect) {
    return effect.flags.wire?.conditions?.some(c => ["start-of-turn-caster", "end-of-turn-caster"].includes(c.condition));
}

export function i18n(...args) {
    if (args.length) {
        return game.i18n.format(...args);
    }
    return game.i18n.localize(...args);
}

export function getTokenSquarePositions(token) {
    const tokenX = token.document._source.x;
    const tokenY = token.document._source.y;
    const tokenW = token.document._source.width;
    const tokenH = token.document._source.height;

    let tokenPositions = [];
    if (tokenW === 1 && tokenH === 1) {
        tokenPositions.push({ x: tokenX, y: tokenY });
    } else {
        const gs = canvas.grid.size;
        for (let x = 0; x < tokenW; x++) {
            for (let y = 0; y < tokenH; y++) {
                tokenPositions.push({ x: tokenX + gs * x, y: tokenY + gs * y });
            }
        }
    }
    return tokenPositions;
}

export function getTokenSquarePositionStrings(token) {
    return getTokenSquarePositions(token).map(p => `${p.x}.${p.y}`);
}

export function getTokenTemplateIds(token, requireAll = false) {
    const tokenPositions = getTokenSquarePositionStrings(token);

    return Object.entries(canvas.grid.highlightLayers)
        .filter(e => e[0].startsWith("MeasuredTemplate."))
        .filter(e => {
            if (requireAll) {
                return tokenPositions.every(p => e[1].positions.has(p));
            } else {
                return tokenPositions.some(p => e[1].positions.has(p));
            }
        })
        .map(e => e[0].substring(17));
}

export function getTemplateTokens(template, requireAll = true) {
    const templatePositions = canvas.grid.highlightLayers[`MeasuredTemplate.${template.id}`]?.positions;
    if (templatePositions) {
        const tokens = canvas.tokens.objects.children;
        const result = tokens
            // .filter(t => !t.document.hidden)
            .filter(t => {
                if (requireAll) {
                    return getTokenSquarePositionStrings(t).every(p => templatePositions.has(p));
                } else {
                    return getTokenSquarePositionStrings(t).some(p => templatePositions.has(p));
                }
            });
        return result;
    }
    return [];
}

export function getTemplateTokenUuids(template, requireAll = true) {
    return getTemplateTokens(template, requireAll).map(t => t.document.uuid);
}

const AsyncFunction = Object.getPrototypeOf(async function(){}).constructor;

export async function runAndAwait(fn, ...args) {
    if (fn.constructor === AsyncFunction) {
        return await fn(...args);
    } else if (fn.constructor === Function) {
        return fn(...args);
    }
}

export async function triggerConditions(actor, condition, { externalTargetActor = null, ignoredEffects = [], details = null } = {}) {
    let result;
    const effects = actor.effects.filter(e => isEffectEnabled(e) && !ignoredEffects.includes(e))
    for (let effect of effects) {
        const conditions = effect.flags.wire?.conditions?.filter(c => c.condition === condition) ?? [];
        for (let condition of conditions) {
            const item = fromUuid(effect.origin);
            const updater = makeUpdater(condition, effect, item, externalTargetActor, details);
            result = await updater?.process();
        }
    }
    return result;
}

export function getDisposition(actor) {
    // Without a token, assume players are friendly, non-players with character sheets are neutral and npc sheet means enemy
    const disp = getActorToken(actor)?.document.disposition;
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
        return game.combat.current.combatantId === combatant?.id;
    } else {
        // Assume out of combat to be the caster's to operate freely
        return true;
    }
}

export async function setTemplateTargeting(state) {
    if (game.modules.get("df-templates")?.active) {
        await game.settings.set("df-templates", "template-targeting-toggle", state);
    }
}

export function damagePartMatchesVariant(formula, variant) {
    const result = formula.match(RollTerm.FLAVOR_REGEXP);
    return (result && result.length && result[0].toLowerCase().includes(variant.toLowerCase()));
}

export function effectMatchesVariant(effect, variant) {
    return effect?.label.toLowerCase().includes(variant?.toLowerCase());
}

export function stringMatchesVariant(str, variant) {
    return str.toLowerCase().includes(variant.toLowerCase());
}

export function isActorEffect(effect) {
    return effect.parent && effect.parent instanceof CONFIG.Actor.documentClass;
}

export function isItemEffect(effect) {
    return effect.parent && effect.parent instanceof CONFIG.Item.documentClass;
}

export function isAuraEffect(effect) {
    return effect.flags.wire?.auraTargets;
}

export function isAuraTargetEffect(effect) {
    return effect.flags.wire?.auraSourceUuid;
}

export function isEffectEnabled(effect) {
    return !effect.isSuppressed && !effect.disabled;
}

export function areAreaConditionsBlockedForActor(item, actor) {
    const itemUuid = item.uuid;
    return !!actor.effects.find(e => isEffectEnabled(e) && e.origin === itemUuid && e.flags.wire?.blocksAreaConditions);
}

export function compositeDamageParts(item) {
    const itemParts = item.system.damage?.parts || [];
    const wireParts = item.flags.wire?.damageParts || [];

    return itemParts.map((parts, i) => {
        return {
            0: parts[0],
            1: parts[1],
            halving: wireParts[i]?.halving,
            application: wireParts[i]?.application
        };
    });
}

export function playAutoAnimation(...args) {
    if (typeof AutoAnimations !== "undefined") {
        AutoAnimations.playAnimation(...args);
    }
}

export function addTokenFX(token, effect) {
    if (typeof TokenMagic !== "undefined") {
        TokenMagic.addFilters(token, effect);
    }
}

export function deleteTokenFX(token, effect) {
    if (typeof TokenMagic !== "undefined") {
        TokenMagic.deleteFilters(token, effect);
    }
}

export function isActorDefeated(actor) {
    return actor.effects.some(e => e.getFlag("core", "statusId") === CONFIG.specialStatusEffects.DEFEATED);
}

export function tokenSeparation(token1, token2) {
    const positions1 = getTokenSquarePositions(token1);
    const positions2 = getTokenSquarePositions(token2);

    let result;

    for (let p1 of positions1) {
        for (let p2 of positions2) {
            const d = canvas.grid.measureDistance(p1, p2, { gridSpaces: true });
            if (result === undefined || result > d) {
                result = d;
            }
        }
    }

    return result;
}

export function makeModifier(value) {
    if (value && !isNaN(+value) && value > 0) {
        return `+${value}`;
    }
    return value;
}

export function handleError(error) {
    const msg = `A technical error occurred. Please check the console error log and notify the GM.`;
    ui.notifications.error(msg);
    console.error(msg, error);
}
