import { runInQueue } from "../action-queue.js";
import { addTokenFX, deleteTokenFX, fromUuid, getActorToken, isActorEffect, isEffectEnabled } from "../utils.js";

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
        ...Object.keys(CONFIG.DND5E.itemActionTypes).flatMap(at => [
            `flags.wire.max.damage.${at}`,
            `flags.wire.min.damage.${at}`,
            `flags.wire.receive.max.damage.${at}`,
            `flags.wire.receive.min.damage.${at}`
        ]),
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
        ...[...Object.keys(CONFIG.DND5E.damageTypes), "healing", "temphp"].flatMap(dt => [
            `flags.wire.max.damage.${dt}`,
            `flags.wire.min.damage.${dt}`,
            `flags.wire.receive.max.damage.${dt}`,
            `flags.wire.receive.min.damage.${dt}`
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

function getFlags(actor) {
    return foundry.utils.mergeObject(
        actor?.data.flags["midi-qol"] || {},
        actor?.data.flags.wire || {}
    );
}

export function getAttackOptions(activation) {
    const attacker = activation.item.actor;
    const defender = activation.singleTarget.actor;

    const attAdv = getFlags(attacker)?.advantage || {};
    const attDis = getFlags(attacker)?.disadvantage || {};
    const gntAdv = getFlags(defender)?.grants?.advantage || {};
    const gntDis = getFlags(defender)?.grants?.disadvantage || {};

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

    const config = activation.config;

    const advantage = config.advantage || (isAdvantage && !isDisdvantage);
    const disadvantage = config.disadvantage || (isDisdvantage && !isAdvantage);

    return { advantage, disadvantage };
}

export function getDamageMultiplier(item, actor, target) {
    const multiplierFlags = getFlags(actor)?.damage?.multiplier || {};

    const globalMultiplier = multiplierFlags.all || 1;
    const actionTypeMultiplier = multiplierFlags.action ? multiplierFlags.action[item.data.data.actionType] || 1 : 1;
    const creatureTypeMultiplier = multiplierFlags.creature ? (target?.data.data.details?.type?.value ? multiplierFlags.creature[target.data.data.details.type.value] || 1 : 1) : 1;
    const abilityMultiplier = multiplierFlags.ability ? multiplierFlags.ability[item.abilityMod] || 1 : 1;

    return globalMultiplier * actionTypeMultiplier * creatureTypeMultiplier * abilityMultiplier;
}

export function getDamageOptions(item, actor, damageType) {
    const maxFlags = getFlags(actor)?.receive?.max?.damage || {};
    const minFlags = getFlags(actor)?.receive?.min?.damage || {};

    const hasMax = maxFlags.all || maxFlags[item.data.data.actionType] || maxFlags[damageType];
    const hasMin = minFlags.all || minFlags[item.data.data.actionType] || minFlags[damageType];

    const maximize = hasMax && !hasMin;
    const minimize = hasMin && !hasMax;

    return { maximize, minimize };
}

export function getSaveOptions(actor, abilityId) {
    const succeedFlags = getFlags(actor)?.succeed || {};
    const failFlags = getFlags(actor)?.fail || {};

    const isSuccess = succeedFlags.ability?.all || succeedFlags.ability?.save?.all || (succeedFlags.ability?.save && succeedFlags.ability.save[abilityId]);
    const isFailure = failFlags.ability?.all || failFlags.ability?.save?.all || (failFlags.ability?.save && failFlags.ability.save[abilityId]);

    const success = isSuccess && !isFailure;
    const failure = isFailure && !isSuccess;

    return { success, failure };
}

export function getAbilityCheckOptions(actor, abilityId) {
    const succeedFlags = getFlags(actor)?.succeed || {};
    const failFlags = getFlags(actor)?.fail || {};

    const isSuccess = succeedFlags.ability?.all || succeedFlags.ability?.check?.all || (succeedFlags.ability?.check && succeedFlags.ability.check[abilityId]);
    const isFailure = failFlags.ability?.all || failFlags.ability?.check?.all || (failFlags.ability?.check && failFlags.ability.check[abilityId]);

    const success = isSuccess && !isFailure;
    const failure = isFailure && !isSuccess;

    return { success, failure };
}

export function applyConditionImmunity(actor, effectDataList) {
    return effectDataList
        .map(effectData => {
            return foundry.utils.mergeObject(effectData, {
                changes: effectData.changes.filter(change => {
                    const keys = [
                        "macro.CE",
                        "StatusEffect",
                        "wire.custom.statusEffect"
                    ]
                    const immunities = [
                        ...actor.data.data.traits?.ci?.value,
                        ...actor.data.data.traits?.ci?.custom?.split(",").map(s => s.trim().toLowerCase())
                    ];
                    return !keys.includes(change.key) || !immunities.includes(change.value.toLowerCase())
                })
            });
        })
        .filter(effectData => {
            return effectData.changes.length;
        });
}

export function initEffectFlagHooks() {
    Hooks.on("createActiveEffect", async (effect, options, user) => {
        if (game.user.isGM && isActorEffect(effect) && isEffectEnabled(effect)) {
            const actor = effect.parent;
            for (let change of effect.data.changes) {
                if (change.key === "wire.custom.statusEffect" || change.key === "wire.custom.persistentStatusEffect") {
                    await runInQueue(async () => {
                        const effectName = change.value;
                        const uuid = actor.uuid;
                        const isLinked = change.key !== "wire.custom.persistentStatusEffect";
                        const origin = isLinked ? effect.data.origin : null;
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
            for (let change of effect.data.changes) {
                if (change.key === "wire.custom.statusEffect" || change.key === "wire.custom.persistentStatusEffect") {
                    if (changes.disabled === false) {
                        await runInQueue(async () => {
                            const effectName = change.value;
                            const uuid = actor.uuid;
                            const isLinked = change.key !== "wire.custom.persistentStatusEffect";
                            const origin = isLinked ? effect.data.origin : null;
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
            for (let change of effect.data.changes) {
                if (change.key === "wire.custom.statusEffect" || change.key === "wire.custom.persistentStatusEffect") {
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
//         for (let change of effect.data.changes) {
//             const item = fromUuid(effect.data.origin);
//             if (isActorEffect(effect) && item && item instanceof CONFIG.Item.documentClass) {
//                 const rollData = this.getRollData();
//                 const itemRollData = item.getRollData();
//                 const config = effect.data.flags?.wire?.activationConfig;
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
    const skill = this.data.data.skills[skillId];
    const abilityId = skill.ability;

    const advFlags = getFlags(this)?.advantage || {};
    const disFlags = getFlags(this)?.disadvantage || {};
    const skillAdv = advFlags.skill || {};
    const skillDis = disFlags.skill || {};
    const abilityAdv = advFlags.ability || {};
    const abilityDis = disFlags.ability || {};

    const isAdvantage   = advFlags.all || abilityAdv.all || abilityAdv.check?.all || (abilityAdv.check && abilityAdv.check[abilityId]) || skillAdv.all || skillAdv[skillId];
    const isDisdvantage = disFlags.all || abilityDis.all || abilityDis.check?.all || (abilityDis.check && abilityDis.check[abilityId]) || skillDis.all || skillDis[skillId];

    const advantage = options.advantage || (isAdvantage && !isDisdvantage);
    const disadvantage = options.disadvantage || (isDisdvantage && !isAdvantage);

    return wrapped.apply(this, [skillId, foundry.utils.mergeObject(options, { advantage, disadvantage })]);
}

function onActorRollAbilityTest(wrapped, abilityId, options) {
    const advFlags = getFlags(this)?.advantage?.ability || {};
    const disFlags = getFlags(this)?.disadvantage?.ability || {};

    const isAdvantage = advFlags.all || advFlags.check?.all || (advFlags.check && advFlags.check[abilityId]);
    const isDisdvantage = disFlags.all || disFlags.check?.all || (disFlags.check && disFlags.check[abilityId]);

    const advantage = options.advantage || (isAdvantage && !isDisdvantage);
    const disadvantage = options.disadvantage || (isDisdvantage && !isAdvantage);

    return wrapped.apply(this, [abilityId, foundry.utils.mergeObject(options, { advantage, disadvantage })]);
}

function onActorRollAbilitySave(wrapped, abilityId, options) {
    const advFlags = getFlags(this)?.advantage?.ability || {};
    const disFlags = getFlags(this)?.disadvantage?.ability || {};

    const isAdvantage = advFlags.all || advFlags.save?.all || (advFlags.save && advFlags.save[abilityId]);
    const isDisdvantage = disFlags.all || disFlags.save?.all || (disFlags.save && disFlags.save[abilityId]);

    const advantage = options.advantage || (isAdvantage && !isDisdvantage);
    const disadvantage = options.disadvantage || (isDisdvantage && !isAdvantage);

    return wrapped.apply(this, [abilityId, foundry.utils.mergeObject(options, { advantage, disadvantage })]);
}

function onActorRollDeathSave(wrapped, options) {
    const advFlags = getFlags(this)?.advantage || {};
    const disFlags = getFlags(this)?.disadvantage || {};

    const isAdvantage = advFlags.deathSave;
    const isDisdvantage = disFlags.deathSave;

    const advantage = options.advantage || (isAdvantage && !isDisdvantage);
    const disadvantage = options.disadvantage || (isDisdvantage && !isAdvantage);

    return wrapped.apply(this, [foundry.utils.mergeObject(options, { advantage, disadvantage })]);
}
