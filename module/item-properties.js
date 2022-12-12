import { compositeDamageParts, damagePartMatchesVariant, isEffectEnabled } from "./utils.js";

const durationUnits = ["day", "hour", "minute", "month", "round", "turn", "year"];
const attackTypes = ["msak", "mwak", "rsak", "rwak"];
const tokenTargetables = ["ally", "creature", "enemy", ""];

export function hasConcentration(item) {
    return item.system.components?.concentration;
}

export function hasDuration(item) {
    return durationUnits.includes(item.system.duration.units);
}

export function isInstantaneous(item) {
    const units = item.system.duration.units;
    return !units || units === "inst";
}

export function isAttack(item) {
    return item.hasAttack;
}

export function isSave(item) {
    return item.system.actionType === "save";
}

export function isTokenTargetable(item) {
    return tokenTargetables.includes(item.system.target.type);
}

export function targetsSingleToken(item) {
    return (!item.system.target.value || item.system.target.value === 1) && isTokenTargetable(item);
}

export function isSelfTarget(item) {
    return item.system.target.type === "self";
}

export function isSelfRange(item) {
    return item.system.range.units === "self";
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

export function isAttackMagical(item) {
    const isActorAttackMagical = item.actor.getFlag("wire", "damage.magical");
    return (item.type === "weapon" && item.system.properties.mgc) || item.type === "spell" || isActorAttackMagical;
}
