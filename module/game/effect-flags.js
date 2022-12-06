import { runInQueue } from "../action-queue.js";
import { addTokenFX, deleteTokenFX, fromUuid, getActorToken, isActorEffect, isEffectEnabled, triggerConditions } from "../utils.js";

export function getWireFlags() {
    return [
        ...[
            "wire.custom.statusEffect",
            "wire.custom.persistentStatusEffect",
            "wire.custom.tokenFX"
        ],
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
            "flags.wire.advantage.deathSave",
            "flags.wire.disadvantage.deathSave"
        ],
        ...Object.keys(CONFIG.DND5E.itemActionTypes).flatMap(at => [
            `flags.wire.advantage.attack.${at}`,
            `flags.wire.disadvantage.attack.${at}`,
            `flags.wire.grants.advantage.attack.${at}`,
            `flags.wire.grants.disadvantage.attack.${at}`
        ]),
        ...[
            "flags.wire.damage.versatile",
            "flags.wire.damage.magical"
        ],
        ...Object.keys(CONFIG.DND5E.creatureTypes).flatMap(ct => [
            `flags.wire.advantage.attack.${ct}`,
            `flags.wire.disadvantage.attack.${ct}`,
            `flags.wire.grants.advantage.attack.${ct}`,
            `flags.wire.grants.disadvantage.attack.${ct}`
        ]),
        ...Object.keys(CONFIG.DND5E.abilities).flatMap(abl => [
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
            "flags.wire.fail.ability.all",
            "flags.wire.fail.ability.check.all",
            "flags.wire.fail.ability.save.all",
            "flags.wire.succeed.ability.all",
            "flags.wire.succeed.ability.check.all",
            "flags.wire.succeed.ability.save.all",
        ],
        ...Object.keys(CONFIG.DND5E.abilities).flatMap(abl => [
            `flags.wire.fail.ability.check.${abl}`,
            `flags.wire.fail.ability.save.${abl}`,
            `flags.wire.succeed.ability.check.${abl}`,
            `flags.wire.succeed.ability.save.${abl}`
        ]),
        
        ...[
            "flags.wire.max.damage.all",
            "flags.wire.min.damage.all",
            "flags.wire.receive.max.damage.all",
            "flags.wire.receive.min.damage.all"
        ],
        ...Object.keys(CONFIG.DND5E.itemActionTypes).flatMap(at => [
            `flags.wire.max.damage.${at}`,
            `flags.wire.min.damage.${at}`,
            `flags.wire.receive.max.damage.${at}`,
            `flags.wire.receive.min.damage.${at}`
        ]),
        ...[...Object.keys(CONFIG.DND5E.damageTypes), "healing", "temphp"].flatMap(dt => [
            `flags.wire.max.damage.${dt}`,
            `flags.wire.min.damage.${dt}`,
            `flags.wire.receive.max.damage.${dt}`,
            `flags.wire.receive.min.damage.${dt}`
        ]),

        ...[
            "flags.wire.critical.all",
            "flags.wire.grants.critical.all",
        ],
        ...Object.keys(CONFIG.DND5E.itemActionTypes).flatMap(at => [
            `flags.wire.critical.${at}`,
            `flags.wire.grants.critical.${at}`,
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

export function getEffectFlags(actor) {
    return foundry.utils.mergeObject(
        actor?.flags["midi-qol"] || {},
        actor?.flags.wire || {}
    );
}

export function getStaticAttackOptions(item, defender, attackConfig) {
    const attacker = item.actor;

    const attAdv = getEffectFlags(attacker)?.advantage || {};
    const attDis = getEffectFlags(attacker)?.disadvantage || {};
    const gntAdv = getEffectFlags(defender)?.grants?.advantage || {};
    const gntDis = getEffectFlags(defender)?.grants?.disadvantage || {};

    const advFlags = foundry.utils.mergeObject(attAdv, gntAdv);
    const disFlags = foundry.utils.mergeObject(attDis, gntDis);

    const usedAbility = item.abilityMod;
    const actionType = item.system.actionType;
    const checkProperties = ["all", "attack.all", `attack.${actionType}`, `attack.${usedAbility}`];

    const attackerType = attacker.system.details?.type?.value || "humanoid";
    const defenderType = defender?.system.details?.type?.value || "humanoid";
    const attackerTypeProperty = `attack.${attackerType}`;
    const defenderTypeProperty = `attack.${defenderType}`;
    const isTypeAdv = foundry.utils.getProperty(attAdv, defenderTypeProperty) || foundry.utils.getProperty(gntAdv, attackerTypeProperty);
    const isTypeDis = foundry.utils.getProperty(attDis, defenderTypeProperty) || foundry.utils.getProperty(gntDis, attackerTypeProperty);

    const isAdvantage = checkProperties.some(p => foundry.utils.getProperty(advFlags, p)) || isTypeAdv;
    const isDisdvantage = checkProperties.some(p => foundry.utils.getProperty(disFlags, p)) || isTypeDis;

    let advantage = (attackConfig?.advantage || (isAdvantage && !isDisdvantage)) && !attackConfig?.disadvantage;
    let disadvantage = (attackConfig?.disadvantage || (isDisdvantage && !isAdvantage)) && !attackConfig?.advantage;

    return { advantage, disadvantage };
}

export async function getAttackOptions(item, defender, config) {
    let { advantage, disadvantage } = getStaticAttackOptions(item, defender, config.attack);
    const { parts, rollData } = item.getAttackToHit() || {};

    if (config.attack?.bonus) {
        parts.push(config.attack.bonus);
    }

    advantage = !config.attack?.disadvantage && !config.attack.normal && (advantage || config.attack?.advantage);
    disadvantage = !config.attack?.advantage && !config.attack.normal && (disadvantage || config.attack?.disadvantage);

    return { advantage, disadvantage, parts, data: rollData };
}

export function getDamageMultiplier(item, actor, target) {
    const multiplierFlags = getEffectFlags(actor)?.damage?.multiplier || {};

    const globalMultiplier = multiplierFlags.all || 1;
    const actionTypeMultiplier = multiplierFlags.action ? multiplierFlags.action[item.system.actionType] || 1 : 1;
    const creatureTypeMultiplier = multiplierFlags.creature ? (target?.system.details?.type?.value ? multiplierFlags.creature[target.system.details.type.value] || 1 : 1) : 1;
    const abilityMultiplier = multiplierFlags.ability ? multiplierFlags.ability[item.abilityMod] || 1 : 1;

    return globalMultiplier * actionTypeMultiplier * creatureTypeMultiplier * abilityMultiplier;
}

export function getDamageInflictingOptions(item, actor, damageType) {
    const maxFlags = getEffectFlags(actor)?.max?.damage || {};
    const minFlags = getEffectFlags(actor)?.min?.damage || {};

    const hasMax = maxFlags.all || maxFlags[item.system.actionType] || maxFlags[damageType];
    const hasMin = minFlags.all || minFlags[item.system.actionType] || minFlags[damageType];

    const maximize = hasMax && !hasMin;
    const minimize = hasMin && !hasMax;

    return { maximize, minimize };
}

export function getDamageReceivingOptions(item, actor, damageType) {
    const maxFlags = getEffectFlags(actor)?.receive?.max?.damage || {};
    const minFlags = getEffectFlags(actor)?.receive?.min?.damage || {};

    const hasMax = maxFlags.all || maxFlags[item.system.actionType] || maxFlags[damageType];
    const hasMin = minFlags.all || minFlags[item.system.actionType] || minFlags[damageType];

    const maximize = hasMax && !hasMin;
    const minimize = hasMin && !hasMax;

    return { maximize, minimize };
}

export function getSaveOptions(actor, abilityId) {
    const succeedFlags = getEffectFlags(actor)?.succeed || {};
    const failFlags = getEffectFlags(actor)?.fail || {};

    const isSuccess = succeedFlags.ability?.all || succeedFlags.ability?.save?.all || (succeedFlags.ability?.save && succeedFlags.ability.save[abilityId]);
    const isFailure = failFlags.ability?.all || failFlags.ability?.save?.all || (failFlags.ability?.save && failFlags.ability.save[abilityId]);

    const success = isSuccess && !isFailure;
    const failure = isFailure && !isSuccess;

    const advFlags = getEffectFlags(actor)?.advantage?.ability || {};
    const disFlags = getEffectFlags(actor)?.disadvantage?.ability || {};

    const isAdvantage = advFlags.all || advFlags.save?.all || (advFlags.save && advFlags.save[abilityId]);
    const isDisdvantage = disFlags.all || disFlags.save?.all || (disFlags.save && disFlags.save[abilityId]);

    const advantage = isAdvantage && !isDisdvantage;
    const disadvantage = isDisdvantage && !isAdvantage;

    return { success, failure, advantage, disadvantage };
}

export function getAbilityCheckOptions(actor, abilityId) {
    const succeedFlags = getEffectFlags(actor)?.succeed || {};
    const failFlags = getEffectFlags(actor)?.fail || {};

    const isSuccess = succeedFlags.ability?.all || succeedFlags.ability?.check?.all || (succeedFlags.ability?.check && succeedFlags.ability.check[abilityId]);
    const isFailure = failFlags.ability?.all || failFlags.ability?.check?.all || (failFlags.ability?.check && failFlags.ability.check[abilityId]);

    const success = isSuccess && !isFailure;
    const failure = isFailure && !isSuccess;

    const advFlags = getEffectFlags(actor)?.advantage?.ability || {};
    const disFlags = getEffectFlags(actor)?.disadvantage?.ability || {};

    const isAdvantage = advFlags.all || advFlags.check?.all || (advFlags.check && advFlags.check[abilityId]);
    const isDisdvantage = disFlags.all || disFlags.check?.all || (disFlags.check && disFlags.check[abilityId]);

    const advantage = isAdvantage && !isDisdvantage;
    const disadvantage = isDisdvantage && !isAdvantage;

    return { success, failure, advantage, disadvantage };
}

export function applyConditionImmunity(actor, effectDataList) {
    return effectDataList
        .filter(effectData => {
            return !effectData.changes.find(change => {
                const keys = [
                    "macro.CE",
                    "StatusEffect",
                    "wire.custom.statusEffect"
                ]
                const immunities = [
                    ...actor.system.traits?.ci?.value,
                    ...actor.system.traits?.ci?.custom?.split(",").map(s => s.trim().toLowerCase())
                ];
                return keys.includes(change.key) && immunities.includes(change.value.toLowerCase())
            });
        });
}

export function initEffectFlagHooks() {
    Hooks.on("createActiveEffect", async (effect, options, user) => {
        if (game.user.isGM && isActorEffect(effect) && isEffectEnabled(effect)) {
            const actor = effect.parent;
            for (let change of effect.changes) {
                if (change.key === "wire.custom.statusEffect" || change.key === "wire.custom.persistentStatusEffect") {
                    await runInQueue(async () => {
                        const effectName = change.value;
                        const uuid = actor.uuid;
                        const isLinked = change.key !== "wire.custom.persistentStatusEffect";
                        const origin = isLinked ? effect.origin : null;
                        await game.dfreds?.effectInterface?.addEffect({ effectName, uuid, origin });
                    });
                }
                if (change.key === "wire.custom.tokenFX") {
                    await runInQueue(async () => {
                        const effectName = change.value;
                        const token = getActorToken(actor);
                        addTokenFX(token, effectName);
                    });
                }
            }
        }
    });

    Hooks.on("updateActiveEffect", async(effect, changes, options, user) => {
        if (game.user.isGM && isActorEffect(effect)) {
            const actor = effect.parent;
            for (let change of effect.changes) {
                if (change.key === "wire.custom.statusEffect" || change.key === "wire.custom.persistentStatusEffect") {
                    if (changes.disabled === false) {
                        await runInQueue(async () => {
                            const effectName = change.value;
                            const uuid = actor.uuid;
                            const isLinked = change.key !== "wire.custom.persistentStatusEffect";
                            const origin = isLinked ? effect.origin : null;
                            await game.dfreds?.effectInterface?.addEffect({ effectName, uuid, origin });
                        });
                    }
                    if (changes.disabled === true) {
                        await runInQueue(async () => {
                            const effectName = change.value;
                            const uuid = actor.uuid;
                            await game.dfreds?.effectInterface?.removeEffect({ effectName, uuid });
                        });
                    }
                }
                if (change.key === "wire.custom.tokenFX") {
                    if (changes.disabled === false) {
                        await runInQueue(async () => {
                            const effectName = change.value;
                            const token = getActorToken(actor);
                            addTokenFX(token, effectName);
                        });
                    }
                    if (changes.disabled === true) {
                        await runInQueue(async () => {
                            const effectName = change.value;
                            const token = getActorToken(actor);
                            deleteTokenFX(token, effectName);
                        });
                    }
                }
            }
        }
    });

    Hooks.on("deleteActiveEffect", async (effect, options, user) => {
        if (game.user.isGM && isActorEffect(effect)) {
            const actor = effect.parent;
            for (let change of effect.changes) {
                if (change.key === "wire.custom.statusEffect" /*|| change.key === "wire.custom.persistentStatusEffect"*/) {
                    await runInQueue(async () => {
                        const effectName = change.value;
                        const uuid = actor.uuid;
                        await game.dfreds?.effectInterface?.removeEffect({ effectName, uuid });
                    });
                }
                if (change.key === "wire.custom.tokenFX") {
                    await runInQueue(async () => {
                        const effectName = change.value;
                        const token = getActorToken(actor);
                        deleteTokenFX(token, effectName);
                    });
                }
            }
        }
    });
}

export function setupRollFlagWrappers() {
    // libWrapper.register("wire", "CONFIG.Actor.documentClass.prototype.prepareDerivedData", onActorPrepareDerivedData, "MIXED");
    // libWrapper.register("wire", "CONFIG.Actor.documentClass.prototype.applyActiveEffects", onActorApplyActiveEffects, "MIXED");
    libWrapper.register("wire", "CONFIG.ActiveEffect.documentClass.prototype.apply", onActiveEffectApply, "MIXED");

    libWrapper.register("wire", "CONFIG.Actor.documentClass.prototype.rollSkill", onActorRollSkill, "MIXED");
    libWrapper.register("wire", "CONFIG.Actor.documentClass.prototype.rollAbilityTest", onActorRollAbilityTest, "MIXED");
    libWrapper.register("wire", "CONFIG.Actor.documentClass.prototype.rollAbilitySave", onActorRollAbilitySave, "MIXED");
    libWrapper.register("wire", "CONFIG.Actor.documentClass.prototype.rollDeathSave", onActorRollDeathSave, "MIXED");
}

// function onActorPrepareDerivedData(wrapped, ...args) {
//     wrapped.apply(this, [...args]);
//
// }


// TODO: Might be nice, unfortunately DAE makes it impossible
// function onActorApplyActiveEffects(wrapped) {
//     for (let effect of this.effects) {
//         for (let change of effect.changes) {
//             const item = fromUuid(effect.origin);
//             if (isActorEffect(effect) && item && item instanceof CONFIG.Item.documentClass) {
//                 const rollData = this.getRollData();
//                 const itemRollData = item.getRollData();
//                 const config = effect.flags?.wire?.activationConfig;
//                 const spellLevel = config?.spellLevel;
//                 itemRollData.level = spellLevel;
//                 rollData.itemLevel = spellLevel;
//                 rollData.spellLevel = spellLevel;
//                 rollData.origin = itemRollData;
//                 rollData.config = config;

//                 change.value = Roll.replaceFormulaData(change.value, rollData);
//             }
//         }
//     }

//     return wrapped();
// }

function onActiveEffectApply(wrapped, actor, change) {
    if (change.key.startsWith("flags.wire.")) {
        const current = foundry.utils.getProperty(actor, change.key) ?? null;

        if (current === null ) {
            let initialValue = null;
            for (let initialKey in flagInitialValues) {
                if (initialKey === change.key || initialKey.endsWith("*") && change.key.startsWith(initialKey.slice(0, initialKey.length - 1))) {
                    initialValue = flagInitialValues[initialKey];
                    break;
                }
            }
            
            if (initialValue !== null) {
                foundry.utils.setProperty(actor, change.key, initialValue);
            }
        }
    }

    wrapped.apply(this, [actor, change]);
}

async function makeRollParts(parts) {
    if (parts && Array.isArray(parts) && parts.length) {
        await Dialog.prompt({
            title: "Irrecoverable bug in the DND5E system",
            content: "Due to a bug in the system, additional bonuses can't be applied to skill, ability check or save rolls. The bonus has been ignored. This will be reverted once the bug has been addressed."
        })
    }
}

async function onActorRollSkill(wrapped, skillId, options) {
    const bonus = await triggerConditions(this, "prepare-skill-check");

    const skill = this.system.skills[skillId];
    const abilityId = skill.ability;

    const advFlags = getEffectFlags(this)?.advantage || {};
    const disFlags = getEffectFlags(this)?.disadvantage || {};
    const skillAdv = advFlags.skill || {};
    const skillDis = disFlags.skill || {};
    const abilityAdv = advFlags.ability || {};
    const abilityDis = disFlags.ability || {};

    const isAdvantage   = advFlags.all || abilityAdv.all || abilityAdv.check?.all || (abilityAdv.check && abilityAdv.check[abilityId]) || skillAdv.all || skillAdv[skillId];
    const isDisdvantage = disFlags.all || abilityDis.all || abilityDis.check?.all || (abilityDis.check && abilityDis.check[abilityId]) || skillDis.all || skillDis[skillId];

    const advantage = options.advantage || (isAdvantage && !isDisdvantage);
    const disadvantage = options.disadvantage || (isDisdvantage && !isAdvantage);

    const parts = await makeRollParts(bonus ? [bonus] : undefined);
    return wrapped.apply(this, [skillId, foundry.utils.mergeObject(options, { advantage, disadvantage/*, parts*/ })]);
}

async function onActorRollAbilityTest(wrapped, abilityId, options) {
    const bonus = await triggerConditions(this, "prepare-ability-check");

    const checkOptions = getAbilityCheckOptions(this, abilityId);
    const advantage = options.advantage || (checkOptions.advantage && !options.disadvantage && !options.normal);
    const disadvantage = options.disadvantage || (checkOptions.disadvantage && !options.advantage && !options.normal);

    const bonusParts = bonus ? [bonus] : [];
    const optionParts = options.parts || [];
    const parts = await makeRollParts([...optionParts, ...bonusParts]);
    return wrapped.apply(this, [abilityId, foundry.utils.mergeObject(options, { advantage, disadvantage/*, parts*/ })]);
}

async function onActorRollAbilitySave(wrapped, abilityId, options) {
    const bonus = await triggerConditions(this, "prepare-ability-save");

    const saveOptions = getSaveOptions(this, abilityId);
    const advantage = options.advantage || (saveOptions.advantage && !options.disadvantage && !options.normal);
    const disadvantage = options.disadvantage || (saveOptions.disadvantage && !options.advantage && !options.normal);

    const bonusParts = bonus ? [bonus] : [];
    const optionParts = options.parts || [];
    const parts = await makeRollParts([...optionParts, ...bonusParts]);
    return wrapped.apply(this, [abilityId, foundry.utils.mergeObject(options, { advantage, disadvantage/*, parts*/ })]);
}

function onActorRollDeathSave(wrapped, options) {
    const advFlags = getEffectFlags(this)?.advantage || {};
    const disFlags = getEffectFlags(this)?.disadvantage || {};

    const isAdvantage = advFlags.deathSave;
    const isDisdvantage = disFlags.deathSave;

    const advantage = options.advantage || (isAdvantage && !isDisdvantage);
    const disadvantage = options.disadvantage || (isDisdvantage && !isAdvantage);

    return wrapped.apply(this, [foundry.utils.mergeObject(options, { advantage, disadvantage })]);
}
