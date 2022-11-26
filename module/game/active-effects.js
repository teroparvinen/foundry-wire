import { wireSocket } from "../socket.js";
import { checkEffectDurationOverride, copyConditions, copyEffectChanges, copyEffectDuration, effectDurationFromItemDuration, effectMatchesVariant, fromUuid, isEffectEnabled, isInCombat, substituteEffectConfig } from "../utils.js";
import { applyConditionImmunity } from "./effect-flags.js";

export async function applyTargetEffects(item, applicationType, allTargetActors, effectiveTargetActors, masterEffect, config, extraData) {
    const actor = item.actor;

    const staticDuration = effectDurationFromItemDuration(item.data.data.duration, isInCombat(actor));
    const appliedDuration = masterEffect ? copyEffectDuration(masterEffect) : staticDuration;

    const effects = item.effects
        .filter(e => isEffectEnabled(e) && !e.data.transfer && (e.getFlag("wire", "applicationType") || "immediate") === applicationType)
        .filter(e => !config.variant || effectMatchesVariant(e, config.variant));
    const allTargetsEffects = effects.filter(e => e.getFlag("wire", "applyOnSaveOrMiss"));
    const effectiveTargetsEffects = effects.filter(e => !e.getFlag("wire", "applyOnSaveOrMiss"));

    const makeEffectData = (effect) => {
        return foundry.utils.mergeObject(
            {
                changes: substituteEffectConfig(actor, config, copyEffectChanges(effect)),
                origin: item.uuid,
                disabled: false,
                icon: effect.data.icon,
                label: effect.data.label,
                duration: checkEffectDurationOverride(appliedDuration, effect),
                flags: {
                    wire: {
                        castingActorUuid: actor.uuid,
                        sourceEffectUuid: effect.uuid,
                        conditions: copyConditions(effect),
                        activationConfig: config,
                        blocksAreaConditions: effect.data.flags.wire?.blocksAreaConditions,
                        masterEffectUuid: (masterEffect && !effect.data.flags.wire?.independentDuration) ? masterEffect.uuid : null
                    },
                    core: {
                        statusId: " "
                    }
                }
            },
            extraData || {}
        )
    };

    const allTargetsEffectData = allTargetsEffects.map(effect => makeEffectData(effect));
    const effectiveTargetsEffectData = effectiveTargetsEffects.map(effect => makeEffectData(effect));

    let createdEffects = [];

    const targetSet = new Set([...allTargetActors, ...effectiveTargetActors]);
    for (let target of targetSet) {
        const data = effectiveTargetActors.includes(target) ? [...allTargetsEffectData, ...effectiveTargetsEffectData] : allTargetsEffectData;

        const sourceEffectUuids = data.map(d => d.flags.wire.sourceEffectUuid);
        const existingEffects = target.effects.filter(e => sourceEffectUuids.includes(e.data.flags.wire?.sourceEffectUuid));
        if (existingEffects.length) {
            await target.deleteEmbeddedDocuments("ActiveEffect", existingEffects.map(e => e.id));
        }
        const checkedData = applyConditionImmunity(target, data);
        if (checkedData.length) {
            const targetEffects = await target.createEmbeddedDocuments("ActiveEffect", checkedData);
            createdEffects.push(...targetEffects);
        }
    }

    const trackedEffectUuids = createdEffects.filter(e => e.data.flags.wire?.masterEffectUuid).map(e => e.uuid);
    await masterEffect?.setFlag("wire", "childEffectUuids", [...(masterEffect?.data.flags.wire?.childEffectUuids || []), ...trackedEffectUuids]);

    return createdEffects;
}

export async function applySingleEffect(effect, targets, masterEffect, config, extraData, { createStatus } = {}) {
    const item = masterEffect ? fromUuid(masterEffect.data.origin) : fromUuid(effect.data.origin);
    const actor = item.actor;

    const staticDuration = effectDurationFromItemDuration(item.data.data.duration, isInCombat(actor));
    const appliedDuration = masterEffect ? copyEffectDuration(masterEffect) : staticDuration;

    const makeEffectData = (effect) => {
        return foundry.utils.mergeObject(
            {
                changes: substituteEffectConfig(actor, config, copyEffectChanges(effect)),
                origin: item.uuid,
                disabled: false,
                icon: effect.data.icon,
                label: effect.data.label,
                duration: checkEffectDurationOverride(appliedDuration, effect),
                flags: {
                    wire: {
                        castingActorUuid: actor.uuid,
                        sourceEffectUuid: effect.uuid,
                        conditions: copyConditions(effect),
                        activationConfig: config,
                        blocksAreaConditions: effect.data.flags.wire?.blocksAreaConditions,
                        masterEffectUuid: (masterEffect && !effect.data.flags.wire?.independentDuration) ? masterEffect.uuid : null
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

        const sourceEffectUuids = data.map(d => d.flags.wire.sourceEffectUuid);
        const existingEffects = target.effects.filter(e => sourceEffectUuids.includes(e.data.flags.wire?.sourceEffectUuid));
        if (existingEffects.length) {
            await target.deleteEmbeddedDocuments("ActiveEffect", existingEffects.map(e => e.id));
        }
        const checkedData = applyConditionImmunity(target, data);
        if (checkedData.length) {
            const targetEffects = await target.createEmbeddedDocuments("ActiveEffect", checkedData);
            createdEffects.push(...targetEffects);
        }
    }

    const trackedEffectUuids = createdEffects.filter(e => e.data.flags.wire?.masterEffectUuid).map(e => e.uuid);
    await masterEffect?.setFlag("wire", "childEffectUuids", [...(masterEffect?.data.flags.wire?.childEffectUuids || []), ...trackedEffectUuids]);

    return createdEffects;
}

export async function removeChildEffects(effect) {
    if (game.user.isGM) {
        const childEffectUuids = effect?.data.flags.wire?.childEffectUuids;
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
        const item = fromUuid(masterEffect.data.origin);
        if (item && target) {
            const effects = item.effects
                .filter(e => isEffectEnabled(e) && !e.data.transfer && (e.getFlag("wire", "applicationType") || "immediate") === applicationType)
            for (let effect of effects) {
                await applySingleEffect(effect, [target], masterEffect, masterEffect.data.flags.wire?.activationConfig);
            }
        }
    } else {
        await wireSocket.executeAsGM("requestCreateChildEffects", masterEffect.uuid, applicationType, target.uuid);
    }
}