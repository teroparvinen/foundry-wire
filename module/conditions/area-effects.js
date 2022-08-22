import { makeUpdater } from "../updater-utility.js";
import { areAllied, areEnemies, fromUuid, getTemplateTokenUuids, getTokenTemplateIds, isEffectEnabled, triggerConditions } from "../utils.js";

export function initAreaConditionHooks() {
    Hooks.on("updateToken", async (tokenDoc, change, update, userId) => {
        if (update.occupationUpdate) { return; }

        if (game.user.isGM && (change.x || change.y)) {
            const actor = tokenDoc.object.actor;
            const currentTemplateIds = getTokenTemplateIds(tokenDoc);
            const visitedTemplateIds = tokenDoc.data.flags?.wire?.visitedTemplateIds;
            const lastOccupiedTemplateIds = tokenDoc.data.flags?.wire?.occupiedTemplateIds;

            const visitedSet = new Set(visitedTemplateIds);
            for (let templateId of currentTemplateIds) {
                // First visit on turn
                if (!visitedSet.has(templateId)) {
                    const effectUuid = canvas.templates.get(templateId)?.data.flags.wire?.masterEffectUuid;
                    const effect = fromUuid(effectUuid);

                    if (effect && isEffectEnabled(effect)) {
                        const conditions = effect.data.flags.wire?.conditions?.filter(c => c.condition.endsWith("enters-area")) ?? [];
                        for (let condition of conditions) {
                            const item = fromUuid(effect.data.origin);

                            let dispositionCheck = false;
                            if (condition.condition.startsWith("ally") && areAllied(actor, item.actor)) { dispositionCheck = true; }
                            else if (condition.condition.startsWith("enemy") && areEnemies(actor, item.actor)) { dispositionCheck = true; }
                            else if (condition.condition.startsWith("creature")) { dispositionCheck = true; }

                            if (dispositionCheck) {
                                const updater = makeUpdater(condition, effect, item, actor);
                                await updater?.process();
                            }
                        }

                        visitedSet.add(templateId);
                        await tokenDoc.setFlag("wire", "visitedTemplateIds", [...visitedSet]);
                    }
                }

                // Walked into
                const template = canvas.templates.get(templateId);
                if (template && template.data.flags.wire?.masterEffectUuid) {
                    await checkTemplateEnvelopment(template.document);
                }
            }

            // Walked out of
            for (let id of (lastOccupiedTemplateIds || []).filter(id => !currentTemplateIds.includes(id))) {
                const template = canvas.templates.get(id);
                if (template && template.data.flags.wire?.masterEffectUuid) {
                    await checkTemplateEnvelopment(template.document);
                }
            }

            // Walked inside of
            const areaEffects = currentTemplateIds
                .map(t => canvas.templates.get(t)?.data.flags.wire?.masterEffectUuid)
                .filter(u => u)
                .map(uuid => fromUuid(uuid))
                .filter(e => e);
            for (let effect of areaEffects) {
                const conditions = effect.data.flags.wire?.conditions?.filter(c => c.condition.endsWith("moves-within-area")) ?? [];
                for (let condition of conditions) {
                    const item = fromUuid(effect.data.origin);

                    let dispositionCheck = false;
                    if (condition.condition.startsWith("ally") && areAllied(actor, item.actor)) { dispositionCheck = true; }
                    else if (condition.condition.startsWith("enemy") && areEnemies(actor, item.actor)) { dispositionCheck = true; }
                    else if (condition.condition.startsWith("creature")) { dispositionCheck = true; }

                    if (dispositionCheck) {
                        const updater = makeUpdater(condition, effect, item, actor);
                        await updater?.process();
                    }
                }
    }

            await tokenDoc.update({ "flags.wire.occupiedTemplateIds": currentTemplateIds }, { occupationUpdate: true });
        }
    });

    Hooks.on("updateCombat", async (combat, change, options, userId) => {
        if (game.user.isGM) {
            const token = canvas.tokens.get(game.combat.current.tokenId);
            await token.document.setFlag("wire", "visitedTemplateIds", getTokenTemplateIds(token));
        }
    });

    Hooks.on("updateMeasuredTemplate", async (templateDoc, change, options, userId) => {
        if (options.envelopmentUpdate) { return; }

        if (game.user.isGM) {
            await checkTemplateEnvelopment(templateDoc);
        }
    });
}

async function checkTemplateEnvelopment(templateDoc) {
    const effect = fromUuid(templateDoc.getFlag("wire", "masterEffectUuid"));
    if (effect && isEffectEnabled(effect)) {
        const previous = await templateDoc.getFlag("wire", "envelopedTokenUuids") || [];
        const current = getTemplateTokenUuids(templateDoc);

        const previousSet = new Set(previous);
        const currentSet = new Set(current);

        const enteredSet = new Set([...currentSet].filter(x => !previousSet.has(x)));
        const exitedSet = new Set([...previousSet].filter(x => !currentSet.has(x)));

        // Enter
        for (let actor of [...enteredSet].map(uuid => fromUuid(uuid)?.actor).filter(a => a)) {
            const conditions = effect.data.flags.wire?.conditions?.filter(c => c.condition.startsWith("area-envelops")) ?? [];
            for (let condition of conditions) {
                const item = fromUuid(effect.data.origin);

                let dispositionCheck = false;
                if (condition.condition.endsWith("ally") && areAllied(actor, item.actor)) { dispositionCheck = true; }
                else if (condition.condition.endsWith("enemy") && areEnemies(actor, item.actor)) { dispositionCheck = true; }
                else if (condition.condition.endsWith("creature")) { dispositionCheck = true; }

                if (dispositionCheck) {
                    const updater = makeUpdater(condition, effect, item, actor);
                    await updater?.process();
                }
            };
        }

        // Exit
        for (let actor of [...exitedSet].map(uuid => fromUuid(uuid)?.actor).filter(a => a)) {
            const conditions = effect.data.flags.wire?.conditions?.filter(c => c.condition.startsWith("area-reveals")) ?? [];
            for (let condition of conditions) {
                const item = fromUuid(effect.data.origin);
                const effects = actor.effects.filter(e => {
                    const itemEffectUuids = item.effects.map(e => e.uuid);
                    return itemEffectUuids.includes(e.data.flags.wire?.sourceEffectUuid);
                })

                for (let effect of effects) {
                    let dispositionCheck = false;
                    if (condition.condition.endsWith("ally") && areAllied(actor, item.actor)) { dispositionCheck = true; }
                    else if (condition.condition.endsWith("enemy") && areEnemies(actor, item.actor)) { dispositionCheck = true; }
                    else if (condition.condition.endsWith("creature")) { dispositionCheck = true; }

                    if (dispositionCheck) {
                        const updater = makeUpdater(condition, effect, item, actor);
                        await updater?.process();
                    }
                }
            }
        }

        await templateDoc.update({ "flags.wire.envelopedTokenUuids": current }, { envelopmentUpdate: true });
    }
}
