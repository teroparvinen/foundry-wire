import { makeUpdater } from "../make-updater.js";
import { fromUuid, getTokenTemplateIds } from "../utils.js";

export function initAreaConditionHooks() {
    Hooks.on("updateToken", async (tokenDoc, change, update, userId) => {
        if (game.user.isGM && (change.x || change.y)) {
            const tokenPosition = `${tokenDoc.data.x}.${tokenDoc.data.y}`;
            const currentTemplateIds = Object.entries(canvas.grid.highlightLayers)
                .filter(e => e[0].startsWith("Template."))
                .filter(e => e[1].positions.has(tokenPosition))
                .map(e => e[0].substring(9));
            const visitedTemplateIds = tokenDoc.data.flags?.wire?.visitedTemplateIds;

            const visitedSet = new Set(visitedTemplateIds);
            for (let templateId of currentTemplateIds) {
                if (!visitedSet.has(templateId)) {
                    const effectUuid = canvas.templates.get(templateId)?.data.flags.wire?.masterEffectUuid;
                    const effect = fromUuid(effectUuid);

                    if (effect && !effect.isSuppressed) {
                        const conditions = effect.data.flags.wire?.conditions?.filter(c => c.condition === "enters-area") ?? [];
                        await Promise.all(conditions.map(async condition => {
                            const item = fromUuid(effect.data.origin);
                            const updater = makeUpdater(condition.update, effect, tokenDoc.object.actor, item);
                            await updater?.process(tokenDoc.object.actor);
                        }));

                        visitedSet.add(templateId);
                        tokenDoc.setFlag("wire", "visitedTemplateIds", [...visitedSet]);
                    }
                }
            }
        }
    });

    Hooks.on("updateCombat", async (combat, change, options, userId) => {
        if (game.user.isGM) {
            const token = canvas.tokens.get(game.combat.current.tokenId);
            token.document.setFlag("wire", "visitedTemplateIds", getTokenTemplateIds(token));
        }
    });

    Hooks.on("updateMeasuredTemplate", async (template, change, options, userId) => {
        
    });
    Hooks.on("preUpdateMeasuredTemplate", async (template, change, options, userId) => {
        
    });
}
