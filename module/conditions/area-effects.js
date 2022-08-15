import { makeUpdater } from "../updater-utility.js";
import { areAllied, areEnemies, fromUuid, getTemplateTokenUuids, getTokenTemplateIds, triggerConditions } from "../utils.js";

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

                    if (effect && !effect.isSuppressed) {
                        const conditions = effect.data.flags.wire?.conditions?.filter(c => c.condition.endsWith("enters-area")) ?? [];
                        await Promise.all(conditions.map(async condition => {
                            const item = fromUuid(effect.data.origin);

                            let dispositionCheck = false;
                            if (condition.condition.startsWith("ally") && areAllied(actor, item.actor)) { dispositionCheck = true; }
                            else if (condition.condition.startsWith("enemy") && areEnemies(actor, item.actor)) { dispositionCheck = true; }
                            else if (condition.condition.startsWith("creature")) { dispositionCheck = true; }

                            if (dispositionCheck) {
                                const updater = makeUpdater(condition, effect, item, actor);
                                await updater?.process();
                            }
                        }));

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
            await Promise.all((lastOccupiedTemplateIds || [])
                .filter(id => !currentTemplateIds.includes(id))
                .map(async id => {
                    const template = canvas.templates.get(id);
                    if (template && template.data.flags.wire?.masterEffectUuid) {
                        await checkTemplateEnvelopment(template.document);
                    }
                })
            );

            await tokenDoc.update({ "flags.wire.occupiedTemplateIds": currentTemplateIds }, { occupationUpdate: true });
        }
    });

    Hooks.on("updateCombat", async (combat, change, options, userId) => {
        if (game.user.isGM) {
            const token = canvas.tokens.get(game.combat.current.tokenId);
            token.document.setFlag("wire", "visitedTemplateIds", getTokenTemplateIds(token));
        }
    });

    Hooks.on("updateMeasuredTemplate", async (templateDoc, change, options, userId) => {
        if (options.envelopmentUpdate) { return; }

        if (game.user.isGM) {
            checkTemplateEnvelopment(templateDoc);
        }
    });
}

async function checkTemplateEnvelopment(templateDoc) {
    const effect = fromUuid(templateDoc.getFlag("wire", "masterEffectUuid"));
    if (effect && !effect.isSuppressed) {
        const previous = templateDoc.getFlag("wire", "envelopedTokenUuids") || [];
        const current = getTemplateTokenUuids(templateDoc);

        const previousSet = new Set(previous);
        const currentSet = new Set(current);

        const enteredSet = new Set([...currentSet].filter(x => !previousSet.has(x)));
        const exitedSet = new Set([...previousSet].filter(x => !currentSet.has(x)));

        // Enter
        await Promise.all([...enteredSet].map(uuid => fromUuid(uuid)?.actor).filter(a => a).map(async actor => {
            const conditions = effect.data.flags.wire?.conditions?.filter(c => c.condition.startsWith("area-envelops")) ?? [];
            await Promise.all(conditions.map(async condition => {
                const item = fromUuid(effect.data.origin);

                let dispositionCheck = false;
                if (condition.condition.endsWith("ally") && areAllied(actor, item.actor)) { dispositionCheck = true; }
                else if (condition.condition.endsWith("enemy") && areEnemies(actor, item.actor)) { dispositionCheck = true; }
                else if (condition.condition.endsWith("creature")) { dispositionCheck = true; }

                if (dispositionCheck) {
                    const updater = makeUpdater(condition, effect, item, actor);
                    await updater?.process();
                }
            }));
        }));

        // Exit
        await Promise.all([...exitedSet].map(uuid => fromUuid(uuid)?.actor).filter(a => a).map(async actor => {
            const conditions = effect.data.flags.wire?.conditions?.filter(c => c.condition.startsWith("area-reveals")) ?? [];
            await Promise.all(conditions.map(async condition => {
                const item = fromUuid(effect.data.origin);

                await Promise.all(actor.effects
                    .filter(e => {
                        const itemEffectUuids = item.effects.map(e => e.uuid);
                        return itemEffectUuids.includes(e.data.flags.wire?.sourceEffectUuid);
                    })
                    .map(async effect => {
                        let dispositionCheck = false;
                        if (condition.condition.endsWith("ally") && areAllied(actor, item.actor)) { dispositionCheck = true; }
                        else if (condition.condition.endsWith("enemy") && areEnemies(actor, item.actor)) { dispositionCheck = true; }
                        else if (condition.condition.endsWith("creature")) { dispositionCheck = true; }
    
                        if (dispositionCheck) {
                            const updater = makeUpdater(condition, effect, item, actor);
                            await updater?.process();
                        }
                    })
                );
            }));
        }));

        await templateDoc.update({ "flags.wire.envelopedTokenUuids": current }, { envelopmentUpdate: true });
    }
}
