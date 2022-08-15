import { checkEffectDurationOverride, copyConditions, copyEffectChanges, copyEffectDuration, effectDurationFromItemDuration, isInCombat } from "../utils.js";


export async function applyTargetEffects(item, applicationType, allTargetActors, effectiveTargetActors, masterEffect) {
    const actor = item.actor;

    const staticDuration = effectDurationFromItemDuration(item.data.data.duration, isInCombat(actor));
    const appliedDuration = masterEffect ? copyEffectDuration(masterEffect) : staticDuration;

    const effects = item.effects.filter(e => !e.isSuppressed && !e.data.transfer && (e.getFlag("wire", "applicationType") || "immediate") === applicationType);
    const allTargetsEffects = effects.filter(e => e.getFlag("wire", "applyOnSaveOrMiss"));
    const effectiveTargetsEffects = effects.filter(e => !e.getFlag("wire", "applyOnSaveOrMiss"));

    const makeEffectData = (effect) => {
        return foundry.utils.mergeObject(
            {
                changes: copyEffectChanges(effect),
                origin: item.uuid,
                disabled: false,
                icon: effect.data.icon,
                label: effect.data.label,
                duration: checkEffectDurationOverride(appliedDuration, effect),
                flags: {
                    wire: {
                        castingActorUuid: actor.uuid,
                        sourceEffectUuid: effect.uuid,
                        conditions: copyConditions(effect)
                    }
                }
            },
            masterEffect ? {
                flags: {
                    wire: {
                        masterEffectUuid: masterEffect.uuid
                    }
                }
            } : {}
        );
    };

    const allTargetsEffectData = allTargetsEffects.map(effect => makeEffectData(effect));
    const effectiveTargetsEffectData = effectiveTargetsEffects.map(effect => makeEffectData(effect));

    let createdEffects = [];

    const applyEffect = async (target, data) => {
        const sourceEffectUuids = data.map(d => d.flags.wire.sourceEffectUuid);
        const existingEffects = target.effects.filter(e => sourceEffectUuids.includes(e.data.flags.wire?.sourceEffectUuid));
        if (existingEffects.length) {
            await target.deleteEmbeddedDocuments("ActiveEffect", existingEffects.map(e => e.id));
        }
        const targetEffects = await target.createEmbeddedDocuments("ActiveEffect", data);
        createdEffects = [...createdEffects, ...targetEffects];
    }

    for (let target of allTargetActors) {
        await applyEffect(target, allTargetsEffectData);
    }
    for (let target of effectiveTargetActors) {
        await applyEffect(target, effectiveTargetsEffectData);
    }

    const masterEffectChildEffectUuids = masterEffect?.data.flags.wire?.childEffectUuids || [];
    await masterEffect?.setFlag("wire", "childEffectUuids", [...masterEffectChildEffectUuids, ...createdEffects.map(e => e.uuid)]);

    return createdEffects;
}
