import { compositeDamageParts, damagePartMatchesVariant, isEffectEnabled } from "./utils.js";

const durationUnits = ["day", "hour", "minute", "month", "round", "turn", "year", "perm"];
const attackTypes = ["msak", "mwak", "rsak", "rwak"];
const tokenTargetables = ["ally", "creature", "enemy", "", null];

export function hasConcentration(item) {
    return item.system.components?.concentration;
}

export function hasDuration(item) {
    return durationUnits.includes(item.system.duration?.units);
}

export function isInstantaneous(item) {
    const units = item instanceof CONFIG.Item.documentClass && item.system.duration?.units;
    return !units || units === "inst";
}

export function isAttack(item) {
    return item.hasAttack;
}

export function isSpell(item) {
    return item.type === "spell";
}

export function isSave(item) {
    return item.system.actionType === "save";
}

export function isTokenTargetable(item) {
    return tokenTargetables.includes(item.system.target?.type);
}

export function targetsSingleToken(item) {
    return (!item.system.target?.value || item.system.target?.value === 1) && isTokenTargetable(item);
}

export function isSelfTarget(item) {
    return item.system.target?.type === "self";
}

export function isSelfRange(item) {
    return item.system.range.units === "self";
}

export function isAura(item) {
    return item.effects.some(e => !!e.flags.wire?.auraTargets);
}

export function isAreaTargetable(item) {
    return item.hasAreaTarget && !isAura(item);
}

export function hasSelfAttachableAreaTarget(item) {
    return isSelfRange(item) && isAreaTargetable(item) && (item.system.target?.type === "sphere" || item.system.target?.type === "radius");
}

export function hasDamageOfType(item, applicationType, variant) {
    return compositeDamageParts(item).some(part => (part.application || "immediate") === applicationType && (!variant || damagePartMatchesVariant(part[0], variant)));
}

export function hasEffectsOfType(item, applicationType, variant) {
    return item.effects.some(e => isEffectEnabled(e) && !e.transfer && 
        (e.getFlag("wire", "applicationType") || "immediate") === applicationType &&
        (!variant || e.label.toLowerCase() === variant.toLowerCase()));
}

export function hasApplicationsOfType(item, applicationType, variant) {
    return hasDamageOfType(item, applicationType, variant) || hasEffectsOfType(item, applicationType, variant);
}

export function hasSaveableDamageOfType(item, applicationType, variant) {
    return compositeDamageParts(item).some(part => (part.application || "immediate") === applicationType && ["none", "half"].includes(part.halving || "none") && (!variant || damagePartMatchesVariant(part[0], variant)));
}

export function hasSaveableEffectsOfType(item, applicationType, variant) {
    return item.effects.some(e => isEffectEnabled(e) && !e.transfer && 
        (e.getFlag("wire", "applicationType") || "immediate") === applicationType && 
        !e.getFlag("wire", "applyOnSaveOrMiss") &&
        (!variant || e.label.toLowerCase() === variant.toLowerCase()));
}

export function hasSaveableApplicationsOfType(item, applicationType, variant) {
    return hasSaveableDamageOfType(item, applicationType, variant) || hasSaveableEffectsOfType(item, applicationType, variant);
}

export function hasUnavoidableDamageOfType(item, applicationType, variant) {
    return compositeDamageParts(item).some(part => (part.application || "immediate") === applicationType && ["full", "half"].includes(part.halving) && (!variant || damagePartMatchesVariant(part[0], variant)));
}

export function hasUnavoidableEffectsOfType(item, applicationType, variant) {
    return item.effects.some(e => isEffectEnabled(e) && !e.transfer && 
        (e.getFlag("wire", "applicationType") || "immediate") === applicationType && 
        e.getFlag("wire", "applyOnSaveOrMiss") &&
        (!variant || e.label.toLowerCase() === variant.toLowerCase()));
}

export function hasUnavoidableApplicationsOfType(item, applicationType, variant) {
    return hasUnavoidableDamageOfType(item, applicationType, variant) || hasUnavoidableEffectsOfType(item, applicationType, variant);
}

export function hasOnlyUnavoidableEffectsOfType(item, applicationType, variant) {
    return !hasSaveableApplicationsOfType(item, applicationType, variant) && hasUnavoidableEffectsOfType(item, applicationType, variant);
}

export function hasOnlyUnavoidableApplicationsOfType(item, applicationType, variant) {
    return !hasSaveableApplicationsOfType(item, applicationType, variant) && hasUnavoidableApplicationsOfType(item, applicationType, variant);
}

export function getAttackProperties(item) {
    const properties = new Set();
    const isActorAttackMagical = item.actor.getFlag("wire", "damage.magical");
    const isSpell = item.type === "spell";
    if (isActorAttackMagical || isSpell) {
        properties.add("mgc");
    }
    if (item.type === "weapon") {
        Object.keys(item.system.properties).filter(k => item.system.properties[k]).forEach(k => properties.add(k));
    }
    return properties;
}
