
export function getWireFlags() {
    return [
        ...[
            "flags.wire.advantage.all",
            "flags.wire.disadvantage.all",
            "flags.wire.advantage.attack.all",
            "flags.wire.disadvantage.attack.all",
            "flags.wire.grants.advantage.attack.all",
            "flags.wire.grants.disadvantage.attack.all",
            "flags.wire.advantage.concentration",
            "flags.wire.disadvantage.concentration",
            "flags.wire.advantage.ability.all",
            "flags.wire.advantage.ability.check.all",
            "flags.wire.advantage.ability.save.all",
            "flags.wire.disadvantage.ability.all",
            "flags.wire.disadvantage.ability.check.all",
            "flags.wire.disadvantage.ability.save.all",
            "flags.wire.advantage.skill.all",
            "flags.wire.disadvantage.skill.all",
            "flags.wire.advantage.save.all",
            "flags.wire.disadvantage.save.all",
            "flags.wire.advantage.deathSave",
            "flags.wire.disadvantage.deathSave"
        ],
        ...Object.keys(CONFIG.DND5E.itemActionTypes).flatMap(at => [
            `flags.wire.advantage.attack.${at}`,
            `flags.wire.disadvantage.attack.${at}`,
            `flags.wire.grants.advantage.attack.${at}`,
            `flags.wire.grants.disadvantage.attack.${at}`
        ]),
        ...Object.keys(CONFIG.DND5E.creatureTypes).flatMap(ct => [
            `flags.wire.advantage.attack.${ct}`,
            `flags.wire.disadvantage.attack.${ct}`,
            `flags.wire.grants.advantage.attack.${ct}`,
            `flags.wire.grants.disadvantage.attack.${ct}`
        ]),
        ...Object.keys(CONFIG.DND5E.abilities).flatMap(abl => [
            `flags.wire.advantage.ability.all.${abl}`,
            `flags.wire.disadvantage.ability.all.${abl}`,
            `flags.wire.advantage.ability.check.${abl}`,
            `flags.wire.disadvantage.ability.check.${abl}`,
            `flags.wire.advantage.ability.save.${abl}`,
            `flags.wire.disadvantage.ability.save.${abl}`,
            `flags.wire.advantage.attack.${abl}`,
            `flags.wire.disadvantage.attack.${abl}`
        ]),
        ...Object.keys(CONFIG.DND5E.skills).flatMap(skill => [
            `flags.wire.advantage.skill.${skill}`,
            `flags.wire.disadvantage.skill.${skill}`
        ]),

        ...[
            "flags.wire.damage.multiplier.all",
        ],
        ...Object.keys(CONFIG.DND5E.itemActionTypes).flatMap(at => [
            `flags.wire.damage.multiplier.action.${at}`
        ]),
        ...Object.keys(CONFIG.DND5E.creatureTypes).flatMap(ct => [
            `flags.wire.damage.multiplier.creature.${ct}`
        ]),
        ...Object.keys(CONFIG.DND5E.abilities).flatMap(abl => [
            `flags.wire.damage.multiplier.ability.${abl}`
        ]),
    ];
}

const flagInitialValues = {
    "flags.wire.damage.multiplier.*": 1
}

export function getAttackOptions(activation) {
    const attacker = activation.item.actor;
    const defender = activation.singleTarget.actor;

    const attAdv = foundry.utils.getProperty(attacker?.data, "flags.wire.advantage") || {};
    const attDis = foundry.utils.getProperty(attacker?.data, "flags.wire.disadvantage") || {};
    const gntAdv = foundry.utils.getProperty(defender?.data, "flags.wire.grants.advantage") || {};
    const gntDis = foundry.utils.getProperty(defender?.data, "flags.wire.grants.disadvantage") || {};

    const advFlags = foundry.utils.mergeObject(attAdv, gntAdv);
    const disFlags = foundry.utils.mergeObject(attDis, gntDis);

    const usedAbility = activation.item.abilityMod;
    const actionType = activation.item.data.data.actionType;
    const checkProperties = ["attack.all", `attack.${actionType}`, `attack.${usedAbility}`];

    const attackerType = attacker.data.data.details?.type?.value || "humanoid";
    const defenderType = defender.data.data.details?.type?.value || "humanoid";
    const attackerTypeProperty = `attack.${attackerType}`;
    const defenderTypeProperty = `attack.${defenderType}`;
    const isTypeAdv = foundry.utils.getProperty(attAdv, defenderTypeProperty) || foundry.utils.getProperty(gntAdv, attackerTypeProperty);
    const isTypeDis = foundry.utils.getProperty(attDis, defenderTypeProperty) || foundry.utils.getProperty(gntDis, attackerTypeProperty);

    const isAdvantage = checkProperties.some(p => foundry.utils.getProperty(advFlags, p)) || isTypeAdv;
    const isDisdvantage = checkProperties.some(p => foundry.utils.getProperty(disFlags, p)) || isTypeDis;

    const advantage = isAdvantage && !isDisdvantage;
    const disadvantage = isDisdvantage && !isAdvantage;

    return { advantage, disadvantage };
}

export function getDamageMultiplier(item, actor, target) {
    const multiplierFlags = actor.data.flags.wire?.damage?.multiplier || {};

    const globalMultiplier = multiplierFlags.all || 1;
    const actionTypeMultiplier = multiplierFlags.action ? multiplierFlags.action[item.data.data.actionType] || 1 : 1;
    const creatureTypeMultiplier = multiplierFlags.creature ? (target?.data.data.details?.type?.value ? multiplierFlags.creature[target.data.data.details.type.value] || 1 : 1) : 1;
    const abilityMultiplier = multiplierFlags.ability ? multiplierFlags.ability[item.abilityMod] || 1 : 1;

    return globalMultiplier * actionTypeMultiplier * creatureTypeMultiplier * abilityMultiplier;
}

export function setupRollFlagWrappers() {
    // libWrapper.register("wire", "CONFIG.Actor.documentClass.prototype.prepareDerivedData", onActorPrepareDerivedData, "MIXED");
    libWrapper.register("wire", "CONFIG.ActiveEffect.documentClass.prototype.apply", onActiveEffectApply, "MIXED");

    libWrapper.register("wire", "CONFIG.Actor.documentClass.prototype.rollSkill", onActorRollSkill, "MIXED");
    libWrapper.register("wire", "CONFIG.Actor.documentClass.prototype.rollAbilityTest", onActorRollAbilityTest, "MIXED");
    libWrapper.register("wire", "CONFIG.Actor.documentClass.prototype.rollAbilitySave", onActorRollAbilitySave, "MIXED");
    libWrapper.register("wire", "CONFIG.Actor.documentClass.prototype.rollDeathSave", onActorRollDeathSave, "MIXED");
}

// function onActorPrepareDerivedData(wrapped, ...args) {
//     wrapped.apply(this, [...args]);
// }

function onActiveEffectApply(wrapped, actor, change) {
    if (change.key.startsWith("flags.wire.")) {
        const current = foundry.utils.getProperty(actor.data, change.key) ?? null;

        if (current === null ) {
            let initialValue = null;
            for (let initialKey in flagInitialValues) {
                if (initialKey === change.key || initialKey.endsWith("*") && change.key.startsWith(initialKey.slice(0, initialKey.length - 1))) {
                    initialValue = flagInitialValues[initialKey];
                    break;
                }
            }
            
            if (initialValue !== null) {
                foundry.utils.setProperty(actor.data, change.key, initialValue);
            }
        }
    }

    wrapped.apply(this, [actor, change]);
}

function onActorRollSkill(wrapped, skillId, options) {
    const isAdvantage = [
        "flags.wire.advantage.skill.all", 
        `flags.wire.advantage.skill.${skillId}`
    ].some(p => foundry.utils.getProperty(this.data, p));
    const isDisdvantage = [
        "flags.wire.disadvantage.skill.all", 
        `flags.wire.disadvantage.skill.${skillId}`
    ].some(p => foundry.utils.getProperty(this.data, p));

    const advantage = isAdvantage && !isDisdvantage;
    const disadvantage = isDisdvantage && !isAdvantage;

    return wrapped.apply(this, [skillId, foundry.utils.mergeObject(options, { advantage, disadvantage })])
}

function onActorRollAbilityTest(wrapped, abilityId, options) {
    const isAdvantage = [
        "flags.wire.advantage.ability.all",
        "flags.wire.advantage.ability.check.all",
        `flags.wire.advantage.ability.all.${abilityId}`,
        `flags.wire.advantage.ability.check.${abilityId}`
    ].some(p => foundry.utils.getProperty(this.data, p));
    const isDisdvantage = [
        "flags.wire.disadvantage.ability.all",
        "flags.wire.disadvantage.ability.check.all",
        `flags.wire.disadvantage.ability.all.${abilityId}`,
        `flags.wire.disadvantage.ability.check.${abilityId}`
    ].some(p => foundry.utils.getProperty(this.data, p));

    const advantage = isAdvantage && !isDisdvantage;
    const disadvantage = isDisdvantage && !isAdvantage;

    return wrapped.apply(this, [abilityId, foundry.utils.mergeObject(options, { advantage, disadvantage })]);
}

function onActorRollAbilitySave(wrapped, abilityId, options) {
    const isAdvantage = [
        "flags.wire.advantage.save.all",
        "flags.wire.advantage.ability.all",
        "flags.wire.advantage.ability.save.all",
        `flags.wire.advantage.ability.all.${abilityId}`,
        `flags.wire.advantage.ability.save.${abilityId}`
    ].some(p => foundry.utils.getProperty(this.data, p));
    const isDisdvantage = [
        "flags.wire.disadvantage.save.all",
        "flags.wire.disadvantage.ability.all",
        "flags.wire.disadvantage.ability.save.all",
        `flags.wire.disadvantage.ability.all.${abilityId}`,
        `flags.wire.disadvantage.ability.save.${abilityId}`
    ].some(p => foundry.utils.getProperty(this.data, p));

    const advantage = isAdvantage && !isDisdvantage;
    const disadvantage = isDisdvantage && !isAdvantage;

    return wrapped.apply(this, [abilityId, foundry.utils.mergeObject(options, { advantage, disadvantage })]);
}

function onActorRollDeathSave(wrapped, options) {
    const isAdvantage = [
        "flags.wire.advantage.save.all",
        "flags.wire.advantage.deathSave"
    ].some(p => foundry.utils.getProperty(this.data, p));
    const isDisdvantage = [
        "flags.wire.disadvantage.save.all",
        "flags.wire.disadvantage.deathSave"
    ].some(p => foundry.utils.getProperty(this.data, p));

    const advantage = isAdvantage && !isDisdvantage;
    const disadvantage = isDisdvantage && !isAdvantage;

    return wrapped.apply(this, [foundry.utils.mergeObject(options, { advantage, disadvantage })]);
}
