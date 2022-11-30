import { makeUpdater } from "../updater-utility.js";
import { areAllied, areAreaConditionsBlockedForActor, areEnemies, fromUuid, getTemplateTokens, getTemplateTokenUuids, getTokenTemplateIds, isEffectEnabled, triggerConditions } from "../utils.js";

export function initAreaConditionHooks() {
    Hooks.on("updateToken", async (tokenDoc, change, update, userId) => {
        if (update.occupationUpdate) { return; }

        if (game.user.isGM && (change.x || change.y)) {
            const actor = tokenDoc.object.actor;
            const currentTemplateIds = getTokenTemplateIds(tokenDoc.object);
            const visitedTemplateIds = tokenDoc.flags?.wire?.visitedTemplateIds;
            const lastOccupiedTemplateIds = tokenDoc.flags?.wire?.occupiedTemplateIds;

            const visitedSet = new Set(visitedTemplateIds);
            for (let templateId of currentTemplateIds) {
                // First visit on turn
                if (!visitedSet.has(templateId)) {
                    const effectUuid = canvas.templates.get(templateId)?.document.flags.wire?.masterEffectUuid;
                    const effect = fromUuid(effectUuid);
                    const item = fromUuid(effect.origin);

                    if (effect && isEffectEnabled(effect) && !areAreaConditionsBlockedForActor(item, actor)) {
                        const conditions = effect.flags.wire?.conditions?.filter(c => c.condition.endsWith("enters-area")) ?? [];
                        for (let condition of conditions) {
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
                if (template && template.document.flags.wire?.masterEffectUuid) {
                    await checkTemplateEnvelopment(template.document);
                }
            }

            // Walked out of
            for (let id of (lastOccupiedTemplateIds || []).filter(id => !currentTemplateIds.includes(id))) {
                const template = canvas.templates.get(id);
                if (template && template.document.flags.wire?.masterEffectUuid) {
                    await checkTemplateEnvelopment(template.document);
                }
            }

            // Walked inside of
            const areaEffects = currentTemplateIds
                .map(t => canvas.templates.get(t)?.document.flags.wire?.masterEffectUuid)
                .filter(u => u)
                .map(uuid => fromUuid(uuid))
                .filter(e => e);
            for (let effect of areaEffects) {
                const item = fromUuid(effect.origin);
                if (!areAreaConditionsBlockedForActor(item, actor)) {
                    const conditions = effect.flags.wire?.conditions?.filter(c => c.condition.endsWith("moves-within-area")) ?? [];
                    for (let condition of conditions) {
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
            }

            await tokenDoc.update({ "flags.wire.occupiedTemplateIds": currentTemplateIds }, { occupationUpdate: true });
        }
    });

    Hooks.on("updateCombat", async (combat, change, options, userId) => {
        if (game.user.isGM) {
            const token = canvas.tokens.get(game.combat.current.tokenId);
            await token?.document.setFlag("wire", "visitedTemplateIds", getTokenTemplateIds(token));
        }
    });

    Hooks.on("createActivationMeasuredTemplate", async (templateDoc) => {
        if (game.user.isGM) {
            await checkTokenOccupation(templateDoc);
            await checkTemplateEnvelopment(templateDoc);
        }
    });

    Hooks.on("updateMeasuredTemplate", async (templateDoc, change, options, userId) => {
        if (options.envelopmentUpdate) { return; }

        if (game.user.isGM) {
            await checkTokenOccupation(templateDoc);
            await checkTemplateEnvelopment(templateDoc);
        }
    });

    Hooks.on("deleteMeasuredTemplate", async (templateDoc, options, user) => {
        if (game.user.isGM) {
            const tokens = canvas.tokens.objects.children;
            tokens.filter(t => t.document.flags.wire?.occupiedTemplateIds?.includes(templateDoc.id)).forEach(async token => {
                await token.document.setFlag("wire", "occupiedTemplateIds", token.document.flags.wire?.occupiedTemplateIds?.filter(t => t !== templateDoc.id));
            });
            tokens.filter(t => t.document.flags.wire?.visitedTemplateIds?.includes(templateDoc.id)).forEach(async token => {
                await token.document.setFlag("wire", "visitedTemplateIds", token.document.flags.wire?.visitedTemplateIds?.filter(t => t !== templateDoc.id));
            });
        }
    });
}

async function checkTokenOccupation(templateDoc) {
    const registeredTokens = canvas.tokens.objects.children.filter(t => t.document.flags.wire?.occupiedTemplateIds?.includes(templateDoc.id));
    const currentTokens = getTemplateTokens(templateDoc, false);

    const enteredSet = new Set(currentTokens.filter(t => !registeredTokens.includes(t)));
    const exitedSet = new Set(registeredTokens.filter(t => !currentTokens.includes(t)));

    for (let token of enteredSet) {
        await token.document.setFlag("wire", "occupiedTemplateIds", [...(token.document.flags.wire?.occupiedTemplateIds || []), templateDoc.id]);
    }
    for (let token of exitedSet) {
        await token.document.setFlag("wire", "occupiedTemplateIds", token.document.flags.wire?.occupiedTemplateIds?.filter(t => t !== templateDoc.id));
    }
}

async function checkTemplateEnvelopment(templateDoc) {
    const effect = fromUuid(templateDoc.getFlag("wire", "masterEffectUuid"));
    if (effect && isEffectEnabled(effect)) {
        const item = fromUuid(effect.origin);

        const previous = templateDoc.getFlag("wire", "envelopedTokenUuids") || [];
        const current = getTemplateTokenUuids(templateDoc);

        const previousSet = new Set(previous);
        const currentSet = new Set(current);

        const enteredSet = new Set([...currentSet].filter(x => !previousSet.has(x)));
        const exitedSet = new Set([...previousSet].filter(x => !currentSet.has(x)));

        // Enter
        for (let actor of [...enteredSet].map(uuid => fromUuid(uuid)?.actor).filter(a => a)) {
            if (!areAreaConditionsBlockedForActor(item, actor)) {
                const conditions = effect.flags.wire?.conditions?.filter(c => c.condition.startsWith("area-envelops")) ?? [];
                for (let condition of conditions) {
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
        }

        // Exit
        for (let actor of [...exitedSet].map(uuid => fromUuid(uuid)?.actor).filter(a => a)) {
            if (!areAreaConditionsBlockedForActor(item, actor)) {
                const conditions = effect.flags.wire?.conditions?.filter(c => c.condition.startsWith("area-reveals")) ?? [];
                for (let condition of conditions) {
                    const effects = actor.effects.filter(e => {
                        const itemEffectUuids = item.effects.map(e => e.uuid);
                        return itemEffectUuids.includes(e.flags.wire?.sourceEffectUuid);
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
        }

        await templateDoc.update({ "flags.wire.envelopedTokenUuids": current }, { envelopmentUpdate: true });
    }
}
