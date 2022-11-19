import { makeModifier } from "../utils.js";

export function getDisplayableSaveComponents(actor, abilityId, short = false) {
    const components = getSaveComponents(actor, abilityId);
    if (components) {
        return Object.entries(components).map(([part, value]) => {
            return {
                i18nKey: `wire.roll-component.${part}${short ? "-short" : ""}`,
                value: makeModifier(value)
            }
        });
    }
}

export function getSaveComponents(actor, abilityId) {
    const abl = actor.data.data.abilities[abilityId];
    const actorRollData = actor.getRollData();

    const parts = {};

    // Add ability modifier
    parts.ability = abl?.mod ?? 0;

    // Include proficiency bonus
    if (abl?.saveProf.hasProficiency) {
        parts.prof = abl.saveProf.term;
    }

    // Include ability-specific saving throw bonus
    if (abl?.bonuses?.save) {
        parts.specificSave = Roll.replaceFormulaData(abl.bonuses.save, actorRollData);
    }

    // Include a global actor ability save bonus
    const bonuses = getProperty(actor.data.data, "bonuses.abilities") || {};
    if ( bonuses.save ) {
        parts.allSaves = Roll.replaceFormulaData(bonuses.save, actorRollData);
    }

    return parts;
}

export function getDisplayableCheckComponents(actor, abilityId, short = false) {
    const components = getCheckComponents(actor, abilityId);
    if (components) {
        return Object.entries(components).map(([part, value]) => {
            return {
                i18nKey: `wire.roll-component.${part}${short ? "-short" : ""}`,
                value: makeModifier(value)
            }
        });
    }
}

export function getCheckComponents(actor, abilityId) {
    const abl = actor.data.data.abilities[abilityId];
    const actorRollData = actor.getRollData();

    const parts = {};

    // Add ability modifier
    parts.ability = abl?.mod ?? 0;

    // Include proficiency bonus
    if (abl?.checkProf.hasProficiency) {
        parts.prof = abl.checkProf.term;
    }

    // Include ability-specific saving throw bonus
    if (abl?.bonuses?.check) {
        parts.specificCheck = Roll.replaceFormulaData(abl.bonuses.check, actorRollData);
    }

    // Include a global actor ability save bonus
    const bonuses = getProperty(actor.data.data, "bonuses.abilities") || {};
    if ( bonuses.check ) {
        parts.allChecks = Roll.replaceFormulaData(bonuses.check, actorRollData);
    }

    return parts;
}
