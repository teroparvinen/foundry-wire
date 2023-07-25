import { runInQueue } from "../action-queue.js";
import { actorConditionImmunityTypes, addTokenFX, deleteTokenFX, evaluateFormula, fromUuid, fudgeToActor, getActorToken, getTokenSquarePositions, isActorEffect, isCharacterActor, isEffectEnabled, triggerConditions, typeCheckedNumber } from "../utils.js";

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
        ...[
            "flags.wire.dualWielder",
            "flags.wire.twoWeaponFighting"
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
            "flags.wire.fail.concentration",
            "flags.wire.fail.deathSave",
            "flags.wire.succeed.ability.all",
            "flags.wire.succeed.ability.check.all",
            "flags.wire.succeed.ability.save.all",
            "flags.wire.succeed.concentration",
            "flags.wire.succeed.deathSave"
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
            "flags.wire.damagereduction.all",
            "flags.wire.damagereduction.physical"
        ],
        ...Object.keys(CONFIG.DND5E.itemActionTypes).flatMap(at => [
            `flags.wire.damagereduction.${at}`,
        ]),
        ...[...Object.keys(CONFIG.DND5E.damageTypes), "healing", "temphp"].flatMap(dt => [
            `flags.wire.damagereduction.${dt}`,
        ]),

        ...[
            "flags.wire.critical.all",
            "flags.wire.grants.critical.all",
            "flags.wire.criticalThreshold",
            "flags.wire.grants.criticalThreshold"
        ],
        ...Object.keys(CONFIG.DND5E.itemActionTypes).flatMap(at => [
            `flags.wire.critical.${at}`,
            `flags.wire.grants.critical.${at}`,
        ]),

        ...[
            "flags.wire.damage.multiplier.all",
            "flags.wire.grants.damage.multiplier.all",
        ],
        ...Object.keys(CONFIG.DND5E.itemActionTypes).flatMap(at => [
            `flags.wire.damage.multiplier.action.${at}`,
            `flags.wire.grants.damage.multiplier.action.${at}`
        ]),
        ...Object.keys(CONFIG.DND5E.creatureTypes).flatMap(ct => [
            `flags.wire.damage.multiplier.creature.${ct}`,
            `flags.wire.grants.damage.multiplier.creature.${ct}`
        ]),
        ...[...Object.keys(CONFIG.DND5E.damageTypes), "healing", "temphp"].flatMap(dt => [
            `flags.wire.damage.multiplier.type.${dt}`,
            `flags.wire.grants.damage.multiplier.type.${dt}`
        ]),
        ...Object.keys(CONFIG.DND5E.abilities).flatMap(abl => [
            `flags.wire.damage.multiplier.ability.${abl}`,
            `flags.wire.grants.damage.multiplier.ability.${abl}`
        ]),
        ...[
            "flags.wire.size.adjustment"
        ]
    ];
}

const flagInitialValues = {
    "flags.wire.damage.multiplier.*": 1,
    "flags.wire.grants.damage.multiplier.*": 1,
    "flags.wire.size.adjustment": 0
}

const switchFlags = [
    "flags.wire.advantage.*",
    "flags.wire.disadvantage.*",
    "flags.wire.grants.advantage.*",
    "flags.wire.grants.disadvantage.*",
    "flags.wire.fail.*",
    "flags.wire.succeed.*",
    "flags.wire.max.*",
    "flags.wire.min.*",
    "flags.wire.receive.max.*",
    "flags.wire.receive.min.*"
]

export function getEffectFlags(actor) {
    return foundry.utils.mergeObject(
        actor?.flags.wire?.["midi-qol"] || {},
        actor?.flags.wire || {}
    );
}

function evaluateAttackFlag(values, attacker, defender, config) {
    if (!Array.isArray(values)) { return values === true || (!isNaN(values) && values > 0); }

    return values.some(value => {
        const item = fromUuid(value.origin);
        const actor = item instanceof CONFIG.Item.documentClass ? item.actor : item
        if (item && actor instanceof CONFIG.Actor.documentClass) {
            const isAttacker = actor === attacker ? 1 : 0;
            const isDefender = actor === defender ? 1 : 0;
        
            const rollData = {
                attacker: attacker?.getRollData() || {},
                defender: defender?.getRollData() || {},
                originator: { isAttacker, isDefender },
                config
            };
        
            return evaluateFormula(value.value, rollData) > 0;
        } else {
            return evaluateFormula(value.value, {}) > 0;
        }
    });
}

function evaluateActorFlag(values, actor, activation) {
    if (!Array.isArray(values)) { return values === true || (!isNaN(values) && values > 0); }

    return values.some(value => {
        const rollData = {
            actor: actor?.getRollData() || {}
        };
    
        const item = fromUuid(value.origin);
        rollData.isFromItem = item === activation?.item ? 1 : 0;
        if (item === activation?.item) {
            rollData.config = activation.config;
            rollData.condition = activation.condition;
        }

        return evaluateFormula(value.value, rollData) > 0;
    });
}

export function getStaticAttackOptions(item, defender, config) {
    const attackConfig = config?.attack;
    const attacker = item.actor;

    const ef = (value) => evaluateAttackFlag(value, attacker, defender, config);

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
    const isTypeAdv = ef(foundry.utils.getProperty(attAdv, defenderTypeProperty)) || ef(foundry.utils.getProperty(gntAdv, attackerTypeProperty));
    const isTypeDis = ef(foundry.utils.getProperty(attDis, defenderTypeProperty)) || ef(foundry.utils.getProperty(gntDis, attackerTypeProperty));

    const isAdvantage = checkProperties.some(p => ef(foundry.utils.getProperty(advFlags, p))) || isTypeAdv;
    const isDisdvantage = checkProperties.some(p => ef(foundry.utils.getProperty(disFlags, p))) || isTypeDis;

    let advantage = (attackConfig?.advantage || (isAdvantage && !isDisdvantage)) && !attackConfig?.disadvantage;
    let disadvantage = (attackConfig?.disadvantage || (isDisdvantage && !isAdvantage)) && !attackConfig?.advantage;

    return { advantage, disadvantage };
}

export async function getAttackOptions(item, defender, config) {
    let { advantage, disadvantage } = getStaticAttackOptions(item, defender, config);

    advantage = !config.attack?.disadvantage && !config.attack.normal && (advantage || config.attack?.advantage);
    disadvantage = !config.attack?.advantage && !config.attack.normal && (disadvantage || config.attack?.disadvantage);

    if (foundry.utils.isNewerVersion(game.system.version, "2.1")) {
        const parts = config.attack?.bonus ? [config.attack.bonus] : [];
        return { advantage, disadvantage, parts };
    } else {
        const { parts, rollData } = item.getAttackToHit() || {};

        if (config.attack?.bonus) {
            parts.push(config.attack.bonus);
        }
    
        return { advantage, disadvantage, parts, data: rollData };
    }
}

export function getDamageInflictingMultiplier(item, actor, target, damageType) {
    const multiplierFlags = getEffectFlags(actor)?.damage?.multiplier || {};

    const globalMultiplier = typeCheckedNumber(multiplierFlags.all, 1);
    const actionTypeMultiplier = multiplierFlags.action ? typeCheckedNumber(multiplierFlags.action[item.system.actionType], 1) : 1;
    const creatureTypeMultiplier = multiplierFlags.creature ? (target?.system.details?.type?.value ? typeCheckedNumber(multiplierFlags.creature[target.system.details.type.value], 1) : 1) : 1;
    const damageTypeMultiplier = multiplierFlags.type ? (damageType ? typeCheckedNumber(multiplierFlags.type[damageType], 1) : 1) : 1;
    const abilityMultiplier = multiplierFlags.ability ? typeCheckedNumber(multiplierFlags.ability[item.abilityMod], 1) : 1;

    return globalMultiplier * actionTypeMultiplier * creatureTypeMultiplier * damageTypeMultiplier * abilityMultiplier;
}

export function getDamageInflictingOptions(item, defender, damageType, config) {
    const actor = item.actor;

    const ef = (value) => evaluateAttackFlag(value, actor, defender, config);

    const maxFlags = getEffectFlags(actor)?.max?.damage || {};
    const minFlags = getEffectFlags(actor)?.min?.damage || {};

    const hasMax = ef(maxFlags.all) || ef(maxFlags[item.system.actionType]) || ef(maxFlags[damageType]);
    const hasMin = ef(minFlags.all) || ef(minFlags[item.system.actionType]) || ef(minFlags[damageType]);

    const maximize = hasMax && !hasMin;
    const minimize = hasMin && !hasMax;

    return { maximize, minimize };
}

export function getDamageReceivingOptions(item, actor, damageType, config) {
    const attacker = item.actor;

    const ef = (value) => evaluateAttackFlag(value, attacker, actor, config);

    const maxFlags = getEffectFlags(actor)?.receive?.max?.damage || {};
    const minFlags = getEffectFlags(actor)?.receive?.min?.damage || {};

    const hasMax = ef(maxFlags.all) || ef(maxFlags[item.system.actionType]) || ef(maxFlags[damageType]);
    const hasMin = ef(minFlags.all) || ef(minFlags[item.system.actionType]) || ef(minFlags[damageType]);

    const maximize = hasMax && !hasMin;
    const minimize = hasMin && !hasMax;

    const multiplierFlags = getEffectFlags(actor)?.grants?.damage?.multiplier || {};
    const source = item.actor;

    const globalMultiplier = typeCheckedNumber(multiplierFlags.all, 1);
    const actionTypeMultiplier = multiplierFlags.action ? typeCheckedNumber(multiplierFlags.action[item.system.actionType], 1) : 1;
    const creatureTypeMultiplier = multiplierFlags.creature ? (source?.system.details?.type?.value ? typeCheckedNumber(multiplierFlags.creature[source.system.details.type.value], 1) : 1) : 1;
    const damageTypeMultiplier = multiplierFlags.type ? (damageType ? typeCheckedNumber(multiplierFlags.type[damageType], 1) : 1) : 1;
    const abilityMultiplier = multiplierFlags.ability ? typeCheckedNumber(multiplierFlags.ability[item.abilityMod], 1) : 1;

    const multiplier = globalMultiplier * actionTypeMultiplier * creatureTypeMultiplier * damageTypeMultiplier * abilityMultiplier;

    return { maximize, minimize, multiplier };
}

export function getDamageReduction(actor) {
    const reductionFlags = foundry.utils.mergeObject(getEffectFlags(actor)?.DR || {}, getEffectFlags(actor)?.damagereduction || {});
    
    const entries = {};

    for (const type in reductionFlags) {
        const amount = Math.max(0, parseInt(reductionFlags[type]) || 0);
        entries[type] = (entries[type] || 0) + amount;
    }

    return entries;
}

export function getSaveOptions(actor, abilityId, activation, { isConcentration } = {}) {
    const ef = (value) => evaluateActorFlag(value, actor, activation);

    const flags = getEffectFlags(actor);

    const succeedFlags = flags?.succeed || {};
    const failFlags = flags?.fail || {};

    const isSuccess = ef(succeedFlags.ability?.all) || ef(succeedFlags.ability?.save?.all) || 
                      (succeedFlags.ability?.save && ef(succeedFlags.ability.save[abilityId])) ||
                      (isConcentration && ef(succeedFlags.concentration));
    const isFailure = ef(failFlags.ability?.all) || ef(failFlags.ability?.save?.all) || 
                      (failFlags.ability?.save && ef(failFlags.ability.save[abilityId])) ||
                      (isConcentration && ef(failFlags.concentration));

    const success = isSuccess && !isFailure;
    const failure = isFailure && !isSuccess;

    const advFlags = flags?.advantage?.ability || {};
    const disFlags = flags?.disadvantage?.ability || {};

    const isAdvantage = ef(flags?.advantage?.all) || ef(advFlags.all) || ef(advFlags.save?.all) || (advFlags.save && ef(advFlags.save[abilityId])) || (isConcentration && ef(flags?.advantage?.concentration));
    const isDisdvantage = ef(flags?.disadvantage?.all) || ef(disFlags.all) || ef(disFlags.save?.all) || (disFlags.save && ef(disFlags.save[abilityId])) || (isConcentration && ef(flags?.disadvantage?.concentration));

    const advantage = isAdvantage && !isDisdvantage;
    const disadvantage = isDisdvantage && !isAdvantage;

    return { success, failure, advantage, disadvantage };
}

export function getDeathSaveOptions(actor) {
    const ef = (value) => evaluateActorFlag(value, actor, undefined);

    const flags = getEffectFlags(actor);

    const succeedFlags = flags?.succeed || {};
    const failFlags = flags?.fail || {};

    const isSuccess = ef(succeedFlags.deathSave);
    const isFailure = ef(failFlags.deathSave);

    const success = isSuccess && !isFailure;
    const failure = isFailure && !isSuccess;

    const advFlags = flags?.advantage || {};
    const disFlags = flags?.disadvantage || {};

    const isAdvantage = ef(advFlags.deathSave);
    const isDisdvantage = ef(disFlags.deathSave);

    const advantage = isAdvantage && !isDisdvantage;
    const disadvantage = isDisdvantage && !isAdvantage;

    return { success, failure, advantage, disadvantage };
}

export function getAbilityCheckOptions(actor, abilityId, activation) {
    const ef = (value) => evaluateActorFlag(value, actor, activation);

    const flags = getEffectFlags(actor);

    const succeedFlags = flags?.succeed || {};
    const failFlags = flags?.fail || {};

    const isSuccess = ef(succeedFlags.ability?.all) || ef(succeedFlags.ability?.check?.all) || (succeedFlags.ability?.check && ef(succeedFlags.ability.check[abilityId]));
    const isFailure = ef(failFlags.ability?.all) || ef(failFlags.ability?.check?.all) || (failFlags.ability?.check && ef(failFlags.ability.check[abilityId]));

    const success = isSuccess && !isFailure;
    const failure = isFailure && !isSuccess;

    const advFlags = flags?.advantage?.ability || {};
    const disFlags = flags?.disadvantage?.ability || {};

    const isAdvantage = ef(flags?.advantage?.all) || ef(advFlags.all) || ef(advFlags.check?.all) || (advFlags.check && ef(advFlags.check[abilityId]));
    const isDisdvantage = ef(flags?.disadvantage?.all) || ef(disFlags.all) || ef(disFlags.check?.all) || (disFlags.check && ef(disFlags.check[abilityId]));

    const advantage = isAdvantage && !isDisdvantage;
    const disadvantage = isDisdvantage && !isAdvantage;

    return { success, failure, advantage, disadvantage };
}

function applyConditionImmunities(actor) {
    const keys = [
        "macro.CE",
        "StatusEffect",
        "wire.custom.statusEffect",
        "wire.custom.persistentStatusEffect"
    ]
    const immunities = actorConditionImmunityTypes(actor);

    const effects = actor.effects
        .filter(effect => {
            return effect.changes.find(change => {
                return keys.includes(change.key) && immunities.includes(change.value.toLowerCase())
            });
        });

    const statuses = actor.effects
        .filter(effect => {
            const statusId = effect.flags.core?.statusId;
            const isConvenient = effect.flags.isConvenient;

            if (isConvenient && immunities.includes(effect.label.toLowerCase()) || immunities.includes(statusId)) {
                return true;
            }
        });

    runInQueue(async () => {
        for (const effect of [...effects, ...statuses]) {
            await effect.delete();
        }
    });
}

export function checkConditionImmunity(actor, effectDataList) {
    const keys = [
        "macro.CE",
        "StatusEffect",
        "wire.custom.statusEffect",
        "wire.custom.persistentStatusEffect"
    ]
    const immunities = [
        ...actor.system.traits?.ci?.value,
        ...actor.system.traits?.ci?.custom?.split(",").map(s => s.trim().toLowerCase())
    ];

    return effectDataList
        .filter(effectData => {
            return !effectData.changes.find(change => {
                return keys.includes(change.key) && immunities.includes(change.value.toLowerCase())
            });
        });
}

export function initEffectFlagHooks() {
    Hooks.on("createActiveEffect", async (effect, options, user) => {
        if (game.user.isGM && isActorEffect(effect) && isEffectEnabled(effect)) {
            const ceApi = game.dfreds?.effectInterface;
            const actor = effect.parent;
            for (let change of effect.changes) {
                if (change.key === "wire.custom.statusEffect" || change.key === "wire.custom.persistentStatusEffect") {
                    await runInQueue(async () => {
                        const effectName = change.value;
                        const uuid = actor.uuid;
                        const isLinked = change.key !== "wire.custom.persistentStatusEffect";
                        const origin = isLinked ? effect.origin : null;
                        if (ceApi?.findEffectByName(effectName)) {
                            if (!ceApi?.hasEffectApplied(effectName, uuid)) {
                                await ceApi?.addEffect({ effectName, uuid, origin });
                            }
                        } else {
                            console.warn(`Status effect "${effectName}" not found`);
                        }
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
            const ceApi = game.dfreds?.effectInterface;
            const actor = effect.parent;
            for (let change of effect.changes) {
                if (change.key === "wire.custom.statusEffect" || change.key === "wire.custom.persistentStatusEffect") {
                    if (changes.disabled === false) {
                        await runInQueue(async () => {
                            const effectName = change.value;
                            const uuid = actor.uuid;
                            const isLinked = change.key !== "wire.custom.persistentStatusEffect";
                            const origin = isLinked ? effect.origin : null;
                            if (ceApi?.findEffectByName(effectName)) {
                                if (!ceApi?.hasEffectApplied(effectName, uuid)) {
                                    await ceApi?.addEffect({ effectName, uuid, origin });
                                }
                            } else {
                                console.warn(`Status effect "${effectName}" not found`);
                            }
                        });
                    }
                    if (changes.disabled === true) {
                        await runInQueue(async () => {
                            const effectName = change.value;
                            const uuid = actor.uuid;
                            if (ceApi?.hasEffectApplied(effectName, uuid)) {
                                await ceApi?.removeEffect({ effectName, uuid });
                            }
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
            const ceApi = game.dfreds?.effectInterface;
            const actor = effect.parent;
            for (let change of effect.changes) {
                if (change.key === "wire.custom.statusEffect") {
                    await runInQueue(async () => {
                        const effectName = change.value;
                        const uuid = actor.uuid;
                        if (ceApi?.hasEffectApplied(effectName, uuid)) {
                            await ceApi?.removeEffect({ effectName, uuid });
                        }
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

    Hooks.on("dnd5e.rollDeathSave", (actor, roll, details) => {
        details.chatString = null;
    })
}

export function setupRollFlagWrappers() {
    // libWrapper.register("wire", "CONFIG.Actor.documentClass.prototype.prepareDerivedData", onActorPrepareDerivedData, "MIXED");
    // libWrapper.register("wire", "CONFIG.Actor.documentClass.prototype.applyActiveEffects", onActorApplyActiveEffects, "MIXED");
    libWrapper.register("wire", "CONFIG.ActiveEffect.documentClass.prototype.apply", onActiveEffectApply, "MIXED");
    libWrapper.register("wire", "CONFIG.Actor.documentClass.prototype._safePrepareData", onActorPrepareData, "MIXED");
    libWrapper.register("wire", "CONFIG.ActiveEffect.documentClass.prototype._displayScrollingStatus", onActiveEffectDisplayScrollingStatus, "MIXED");

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
    if (change.effect.flags.wire?.auraTargets === "enemy" && fromUuid(change.effect.origin).actor === actor) {
        return;
    }

    let ret;
    if (change.key.startsWith("flags.wire.")) {
        const current = foundry.utils.getProperty(actor, change.key) ?? null;

        for (let switchKey of switchFlags) {
            if (switchKey === change.key || switchKey.endsWith("*") && change.key.startsWith(switchKey.slice(0, switchKey.length - 1))) {
                const changes = {}
                const origin = change.effect.origin;
                const value = change.value;
                const changeValue = [...(current || []), { origin, value }];

                foundry.utils.setProperty(actor, change.key, changeValue)
                changes[change.key] = changeValue;

                return changes;
            }
        }

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

        ret = wrapped.apply(this, [actor, change]);
    } else if (change.key.startsWith("flags.midi-qol.")) {
        const wireKey = "flags.wire.midi-qol." + change.key.substring("flags.midi-qol.".length);
        const copy = duplicate(change);
        copy.key = wireKey;
        copy.mode = CONST.ACTIVE_EFFECT_MODES.ADD;
        copy.value = true;
        ret = wrapped.apply(this, [actor, copy]);
    } else {
        ret = wrapped.apply(this, [actor, change]);
    }

    return ret;
}

function checkActorTokenSizeAdjustment(actor) {
    const sizes = Object.keys(CONFIG.DND5E.actorSizes);

    const current = foundry.utils.getProperty(actor, "system.traits.size") ?? "med";
    const adjustment = foundry.utils.getProperty(actor, "flags.wire.size.adjustment") || 0;

    const currentIndex = sizes.indexOf(current);
    if (currentIndex >= 0) {
        const newIndex = Math.max(Math.min(currentIndex + adjustment, sizes.length - 1), 0);
        const newSize = sizes[newIndex];
        
        foundry.utils.setProperty(actor, "system.traits.size", newSize);
        foundry.utils.setProperty(actor, "overrides.system.traits.size", newSize);
    }
}

function checkActorTokenSize(actor) {
    const currentSystemSize = foundry.utils.getProperty(actor, "system.traits.size") || "med";
    const subsquareTargetSize = CONFIG.DND5E.tokenSizes[currentSystemSize];
    if (!subsquareTargetSize) return;

    const targetSize = Math.max(subsquareTargetSize, 1);

    const token = getActorToken(actor);
    if (!token) return;

    const subsquareExistingSize = Math.max(token.document._source.width, token.document._source.height);
    const existingSize = Math.ceil(subsquareExistingSize);

    const gs = canvas.grid.size;
    const hs = gs * 0.5;

    if (targetSize != existingSize) {
        function getExpandedPosition(x, y, size, dx, dy) {
            const corner = {
                x: dx < 0 ? x + hs : x + size * gs - hs,
                y: dy < 0 ? y + hs : y + size * gs - hs
            }
            const cornerTest = {
                x: corner.x + dx * gs,
                y: corner.y + dy * gs
            }

            let hrays = [...Array(size).keys()].map(i => {
                const edge = {
                    x: x + i * gs + hs,
                    y: dy < 0 ? y + hs : y + size * gs - hs
                }
                const edgeTest = {
                    x: edge.x,
                    y: edge.y + dy * gs
                }
                return [edge, edgeTest];
            })
            let vrays = [...Array(size).keys()].map(i => {
                const edge = {
                    x: dx < 0 ? x + hs : x + size * gs - hs,
                    y: y + i * gs + hs
                }
                const edgeTest = {
                    x: edge.x + dx * gs,
                    y: edge.y
                }
                return [edge, edgeTest];
            })
            const rays = [[corner, cornerTest], ...hrays, ...vrays];
            const isValid = rays.every(pair => !CONFIG.Canvas.losBackend.testCollision(pair[0], pair[1], { mode: "any", type: "move" }));
            if (isValid) {
                return {
                    x: dx < 0 ? x + dx * gs : x,
                    y: dy < 0 ? y + dy * gs : y
                }
            }
        }

        function getExpandedPositions(x, y, size) {
            const deltas = [[1, 1], [1, -1], [-1, 1], [-1, -1]];
            return deltas.map(d => getExpandedPosition(x, y, size, d[0], d[1])).filter(p => p);
        }

        let positionsByDistance;
        let currentSize = existingSize;
        if (targetSize > existingSize) {
            const [x, y] = canvas.grid.grid.getTopLeft(token.document.x, token.document.y);
            let validPositions = [{ x, y }];

            while (currentSize < targetSize) {
                const expandedPositions = validPositions.flatMap(p => getExpandedPositions(p.x, p.y, currentSize));
                if (expandedPositions.length) {
                    currentSize++;
                    validPositions = expandedPositions;
                } else {
                    break;
                }
            }

            positionsByDistance = validPositions.map(p => {
                const c = { x: p.x + currentSize * hs, y: p.y + currentSize * hs };
                const dx = token.center.x - c.x;
                const dy = token.center.y - c.y;
                return { d: dx*dx + dy*dy, p };
            });
        } else {
            currentSize = targetSize;
            positionsByDistance = [];
            for (let i = 0; i <= existingSize - targetSize; i++) {
                for (let j = 0; j <= existingSize - targetSize; j++) {
                    const p = { x: token.document.x + i * gs, y: token.document.y + j * gs };
                    const c = { x: p.x + currentSize * hs, y: p.y + currentSize * hs };
                    const dx = token.center.x - c.x;
                    const dy = token.center.y - c.y;
                    positionsByDistance.push({ d: dx*dx + dy*dy, p });
                }
            }

            if (currentSize == 1 && subsquareTargetSize < currentSize) currentSize = subsquareTargetSize;
        }

        positionsByDistance.sort((a, b) => a.d - b.d);
        const shortestDistance = positionsByDistance[0].d;
        const candidates = positionsByDistance.filter(p => p.d == shortestDistance).map(p => p.p);
        const position = candidates[Math.floor(Math.random() * candidates.length)];

        token.document.update({ x: position.x, y: position.y, width: currentSize, height: currentSize});
    } else if (subsquareExistingSize != subsquareTargetSize) {
        const [x, y] = canvas.grid.grid.getTopLeft(token.document.x, token.document.y);
        token.document.update({ x, y, width: subsquareTargetSize, height: subsquareTargetSize});
    }
}

function onActorPrepareData(wrapped) {
    wrapped();

    if (game.user.isGM && isCharacterActor(this)) {
        checkActorTokenSizeAdjustment(this);
        checkActorTokenSize(this);
        applyConditionImmunities(this);
    }
}

function onActiveEffectDisplayScrollingStatus(wrapped, enabled) {
    if (isActorEffect(this) && fromUuid(this.origin)?.system?.duration?.units === "inst" && !this.flags.wire?.independentDuration) {
        return;
    }
    wrapped(enabled);
}

async function setRollParts(options, parts) {
    if (foundry.utils.isNewerVersion(game.system.version, "2.1")) {
        options.parts = parts;
    } else {
        if (parts && Array.isArray(parts) && parts.length) {
            await Dialog.prompt({
                title: "Irrecoverable bug in the DND5E system",
                content: "Due to a bug in this version of the system, additional bonuses can't be applied to skill, ability check or save rolls. The bonus has been ignored. The 2.1 version of the system has fixed this issue, but please make sure all your modules support it before upgrading."
            })
        }
        delete options.parts;
    }
    return options;
}

async function onActorRollSkill(wrapped, skillId, options) {
    const bonus = await triggerConditions(this, "prepare-skill-check");

    const skill = this.system.skills[skillId];
    const abilityId = skill.ability;

    const ef = (value) => evaluateActorFlag(value, this);

    const advFlags = getEffectFlags(this)?.advantage || {};
    const disFlags = getEffectFlags(this)?.disadvantage || {};
    const skillAdv = advFlags.skill || {};
    const skillDis = disFlags.skill || {};
    const abilityAdv = advFlags.ability || {};
    const abilityDis = disFlags.ability || {};

    const isAdvantage   = ef(advFlags.all) || ef(abilityAdv.all) || ef(abilityAdv.check?.all) || (abilityAdv.check && ef(abilityAdv.check[abilityId])) || ef(skillAdv.all) || ef(skillAdv[skillId]);
    const isDisdvantage = ef(disFlags.all) || ef(abilityDis.all) || ef(abilityDis.check?.all) || (abilityDis.check && ef(abilityDis.check[abilityId])) || ef(skillDis.all) || ef(skillDis[skillId]);

    const advantage = options.advantage || (isAdvantage && !isDisdvantage);
    const disadvantage = options.disadvantage || (isDisdvantage && !isAdvantage);

    return wrapped.apply(this, [skillId, await setRollParts(foundry.utils.mergeObject(options, { advantage, disadvantage }), bonus ? [bonus] : [])]);
}

async function onActorRollAbilityTest(wrapped, abilityId, options) {
    const bonus = await triggerConditions(this, "prepare-ability-check");

    const checkOptions = getAbilityCheckOptions(this, abilityId);
    const advantage = options.advantage || (checkOptions.advantage && !options.disadvantage && !options.normal);
    const disadvantage = options.disadvantage || (checkOptions.disadvantage && !options.advantage && !options.normal);

    const bonusParts = bonus ? [bonus] : [];
    const optionParts = options.parts || [];
    return wrapped.apply(this, [abilityId, await setRollParts(foundry.utils.mergeObject(options, { advantage, disadvantage }), [...optionParts, ...bonusParts])]);
}

async function onActorRollAbilitySave(wrapped, abilityId, options) {
    const bonus = await triggerConditions(this, "prepare-ability-save");

    const saveOptions = getSaveOptions(this, abilityId, undefined, options);
    const advantage = options.advantage || (saveOptions.advantage && !options.disadvantage && !options.normal);
    const disadvantage = options.disadvantage || (saveOptions.disadvantage && !options.advantage && !options.normal);

    const bonusParts = bonus ? [bonus] : [];
    const optionParts = options.parts || [];
    return wrapped.apply(this, [abilityId, await setRollParts(foundry.utils.mergeObject(options, { advantage, disadvantage }), [...optionParts, ...bonusParts])]);
}

function onActorRollDeathSave(wrapped, options) {
    const saveOptions = getDeathSaveOptions(this);

    const advantage = options.advantage || (saveOptions.advantage && !options.disadvantage && !options.normal);
    const disadvantage = options.disadvantage || (saveOptions.disadvantage && !options.advantage && !options.normal);

    return wrapped.apply(this, [foundry.utils.mergeObject(options, { advantage, disadvantage })]);
}
