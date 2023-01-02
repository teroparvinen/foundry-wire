import { wireSocket } from "../socket.js";
import { checkEffectDurationOverride, copyConditions, copyEffectChanges, copyEffectDuration, effectDurationFromItemDuration, effectMatchesVariant, fromUuid, isEffectEnabled, isInCombat, rollChangeValues, substituteEffectConfig } from "../utils.js";
import { checkConditionImmunity } from "./effect-flags.js";

export async function applyTargetEffects(item, applicationType, allTargetActors, effectiveTargetActors, masterEffect, config, extraData) {
    const actor = item.actor;

    const staticDuration = effectDurationFromItemDuration(item.system.duration, isInCombat(actor));
    const appliedDuration = masterEffect ? copyEffectDuration(masterEffect) : staticDuration;

    const effects = item.effects
        .filter(e => isEffectEnabled(e) && !e.transfer && (e.getFlag("wire", "applicationType") || "immediate") === applicationType)
        .filter(e => !config?.variant || effectMatchesVariant(e, config?.variant));
    const allTargetsEffects = effects.filter(e => e.getFlag("wire", "applyOnSaveOrMiss"));
    const effectiveTargetsEffects = effects.filter(e => !e.getFlag("wire", "applyOnSaveOrMiss"));

    const makeEffectDataAndRolls = (effect) => {
        const { changes, rolls } = rollChangeValues(substituteEffectConfig(actor, config, copyEffectChanges(effect)), effect.flags.wire?.rollEffects);
        
        const data = foundry.utils.mergeObject(
            {
                changes,
                origin: item.uuid,
                disabled: false,
                icon: effect.icon,
                label: effect.label,
                duration: checkEffectDurationOverride(appliedDuration, effect),
                flags: {
                    wire: {
                        castingActorUuid: actor.uuid,
                        sourceEffectUuid: effect.uuid,
                        conditions: copyConditions(effect),
                        applicationType,
                        activationConfig: config,
                        blocksAreaConditions: effect.flags.wire?.blocksAreaConditions,
                        stackEffects: effect.flags.wire?.stackEffects,
                        independentDuration: effect.flags.wire?.independentDuration,
                        auraTargets: effect.flags.wire?.auraTargets,
                        masterEffectUuid: (masterEffect && !effect.flags.wire?.independentDuration) ? masterEffect.uuid : null
                    },
                    core: {
                        statusId: " "
                    }
                }
            },
            extraData || {}
        );

        return { data, rolls };
    };

    const allDataAndRolls = allTargetsEffects.map(effect => makeEffectDataAndRolls(effect));
    const effectiveDataAndRolls = effectiveTargetsEffects.map(effect => makeEffectDataAndRolls(effect));

    const allTargetsEffectData = allDataAndRolls.map(e => e.data);
    const effectiveTargetsEffectData = effectiveDataAndRolls.map(e => e.data);
    const allRolls = allDataAndRolls.flatMap(e => e.rolls);
    const effectiveRolls = effectiveDataAndRolls.flatMap(e => e.rolls);

    await Promise.all([...allRolls, ...effectiveRolls].map(roll => game.dice3d?.showForRoll(roll, game.user, !game.user.isGM)));

    let createdEffects = [];

    const targetSet = new Set([...allTargetActors, ...effectiveTargetActors]);
    for (let target of targetSet) {
        const data = effectiveTargetActors.includes(target) ? [...allTargetsEffectData, ...effectiveTargetsEffectData] : allTargetsEffectData;

        const sourceEffectUuids = data.filter(d => !d.flags.wire.stackEffects).map(d => d.flags.wire.sourceEffectUuid);
        const existingEffects = target.effects.filter(e => sourceEffectUuids.includes(e.flags.wire?.sourceEffectUuid));
        if (existingEffects.length) {
            await target.deleteEmbeddedDocuments("ActiveEffect", existingEffects.map(e => e.id));
        }
        const checkedData = checkConditionImmunity(target, data);
        if (checkedData.length) {
            const targetEffects = await target.createEmbeddedDocuments("ActiveEffect", checkedData);
            createdEffects.push(...targetEffects);
        }
    }

    const trackedEffectUuids = createdEffects.filter(e => e.flags.wire?.masterEffectUuid).map(e => e.uuid);
    await masterEffect?.setFlag("wire", "childEffectUuids", [...(masterEffect?.flags.wire?.childEffectUuids || []), ...trackedEffectUuids]);

    return createdEffects;
}

export async function applySingleEffect(effect, targets, masterEffect, config, extraData, { createStatus, skipAuraTransfer } = {}) {
    const item = masterEffect ? fromUuid(masterEffect.origin) : fromUuid(effect.origin);
    const actor = item.actor;

    const staticDuration = effectDurationFromItemDuration(item.system.duration, isInCombat(actor));
    const appliedDuration = masterEffect ? copyEffectDuration(masterEffect) : staticDuration;

    const makeEffectData = (effect) => {
        return foundry.utils.mergeObject(
            {
                changes: substituteEffectConfig(actor, config, copyEffectChanges(effect)),
                origin: item.uuid,
                disabled: false,
                icon: effect.icon,
                label: effect.label,
                duration: checkEffectDurationOverride(appliedDuration, effect),
                flags: {
                    wire: {
                        castingActorUuid: actor.uuid,
                        sourceEffectUuid: effect.uuid,
                        conditions: copyConditions(effect),
                        applicationType,
                        activationConfig: config,
                        blocksAreaConditions: effect.flags.wire?.blocksAreaConditions,
                        stackEffects: effect.flags.wire?.stackEffects,
                        independentDuration: effect.flags.wire?.independentDuration,
                        auraTargets: !skipAuraTransfer && effect.flags.wire?.auraTargets,
                        masterEffectUuid: (masterEffect && !effect.flags.wire?.independentDuration) ? masterEffect.uuid : null
                    },
                    core: createStatus ? {
                        statusId: " "
                    } : undefined
                }
            },
            extraData || {}
        )
    };

    const effectData = makeEffectData(effect);

    let createdEffects = [];

    for (let target of targets) {
        const data = [effectData];

        const sourceEffectUuids = data.filter(d => !d.flags.wire.stackEffects).map(d => d.flags.wire.sourceEffectUuid);
        const existingEffects = target.effects.filter(e => sourceEffectUuids.includes(e.flags.wire?.sourceEffectUuid));
        if (existingEffects.length) {
            await target.deleteEmbeddedDocuments("ActiveEffect", existingEffects.map(e => e.id));
        }
        const checkedData = checkConditionImmunity(target, data);
        if (checkedData.length) {
            const targetEffects = await target.createEmbeddedDocuments("ActiveEffect", checkedData);
            createdEffects.push(...targetEffects);
        }
    }

    const trackedEffectUuids = createdEffects.filter(e => e.flags.wire?.masterEffectUuid).map(e => e.uuid);
    await masterEffect?.setFlag("wire", "childEffectUuids", [...(masterEffect?.flags.wire?.childEffectUuids || []), ...trackedEffectUuids]);

    return createdEffects;
}

export async function removeChildEffects(effect) {
    if (game.user.isGM) {
        const childEffectUuids = effect?.flags.wire?.childEffectUuids;
        await effect.setFlag("wire", "childEffectUuids", []);
        for (let effectUuid of childEffectUuids) {
            await fromUuid(effectUuid)?.delete();
        }
    } else {
        await wireSocket.executeAsGM("requestRemoveChildEffects", effect.uuid);
    }
}

export async function createChildEffects(masterEffect, applicationType, target) {
    if (game.user.isGM) {
        const item = fromUuid(masterEffect.origin);
        if (item && target) {
            const effects = item.effects
                .filter(e => isEffectEnabled(e) && !e.transfer && (e.getFlag("wire", "applicationType") || "immediate") === applicationType)
            for (let effect of effects) {
                await applySingleEffect(effect, [target], masterEffect, masterEffect.flags.wire?.activationConfig);
            }
        }
    } else {
        await wireSocket.executeAsGM("requestCreateChildEffects", masterEffect.uuid, applicationType, target.uuid);
    }
}