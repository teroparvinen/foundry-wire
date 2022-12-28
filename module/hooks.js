import { runInQueue } from "./action-queue.js";
import { Activation } from "./activation.js";
import { ConcentrationCard } from "./cards/concentration-card.js";
import { DamageCard } from "./cards/damage-card.js";
import { DeathSaveCard } from "./cards/death-save-card.js";
import { ItemCard } from "./cards/item-card.js";
import { resetVisitedTemplates } from "./conditions/area-effects.js";
import { updateCombatTurnEndConditions, updateCombatTurnStartConditions } from "./conditions/combat-turns.js";
import { checkCombatDurations } from "./durations.js";
import { applySingleEffect } from "./game/active-effects.js";
import { getDisplayableAttackComponents } from "./game/attack-components.js";
import { getStaticAttackOptions, getWireFlags } from "./game/effect-flags.js";
import { createTemplate } from "./templates.js";
import { makeUpdater } from "./updater-utility.js";
import { areAllied, areEnemies, evaluateFormula, fromUuid, getActorToken, i18n, isActorEffect, isAuraEffect, isAuraTargetEffect, isEffectEnabled, isItemActorOnCanvas, tokenSeparation, triggerConditions } from "./utils.js";

export function initHooks() {
    Hooks.on("renderChatLog", (app, html, data) => {
        ItemCard.activateListeners(html)
        DamageCard.activateListeners(html);
        ConcentrationCard.activateListeners(html);
        DeathSaveCard.activateListeners(html);
        
        html.on("click", ".clickable-token", function(event) {
            const token = fromUuid(event.target.dataset.tokenUuid)?.object;
            token?.control({ releaseOthers: true });
        });
    });
    Hooks.on("renderChatPopout", (app, html, data) => ItemCard.activateListeners(html));

    Hooks.on("createChatMessage", async (message, options, user) => {
        await runInQueue(async () => {
            if (game.user.isGM && !message.isAuthor && message.getFlag("wire", "originatorUserId")) {
                const gmMessageData = {
                    content: message.content,
                    flags: foundry.utils.mergeObject(message.flags, { "wire.isGmView": true }),
                    flavor: message.flavor,
                    speaker: message.speaker,
                    user: game.user.id,
                    whisper: [game.user.id]
                };
                const gmMessage = await ChatMessage.create(gmMessageData);
    
                if (gmMessage) {
                    const activation = await Activation._initializeGmMessage(gmMessage, message);
                    await activation._updateCard();
                }
            }
        });
    });

    Hooks.on("deleteChatMessage", async (message, options, user) => {
        if (game.user.isGM && message.getFlag("wire", "originatorUserId")) {
            await removeLinkedMessage(message.getFlag("wire", "masterMessageUuid"));
            await removeLinkedMessage(message.getFlag("wire", "gmMessageUuid"));
            await removeLinkedMessage(message.getFlag("wire", "playerMessageUuid"));

            const templateUuid = message.flags.wire?.activation?.templateUuid;
            const masterEffectUuid = message.flags.wire?.activation?.masterEffectUuid;
            if (!masterEffectUuid && templateUuid) {
                fromUuid(templateUuid)?.delete();
            }
        }
    });

    Hooks.on("renderChatMessage", async (message, html, data) => {
        const shouldHidePlayerOriginated = game.user.isGM && !message.isAuthor && message.getFlag("wire", "originatorUserId");
        const shouldHidePlayerView = game.user.isGM && message.getFlag("wire", "isPlayerView");
        const isExplicitlyHidden = message.getFlag("wire", "isHidden");
        const isHiddenFromPlayer = !game.user.isGM && ((message.blind) || (message.whisper.length && !message.isAuthor && !message.whisper.includes(game.user.id)));

        if (shouldHidePlayerOriginated || shouldHidePlayerView || isExplicitlyHidden || isHiddenFromPlayer) {
            html[0].classList.add("wire-gm-hide");
        }

        const hideSpeakerFields = message.getFlag("wire", "hideSpeakerFields");
        if (hideSpeakerFields) {
            html[0].classList.add("wire-hide-speaker-fields");
        }

        if (message.getFlag("wire", "isPrimaryRoll") || message.getFlag("wire", "activation") || message.getFlag("wire", "isGmView")) {
            html[0].classList.add("wire-activation-view");
        }
        if (message.getFlag("wire", "isDamageCard")) {
            html[0].classList.add("wire-damage-card");
        }
        if (message.getFlag("wire", "isConcentrationCard")) {
            html[0].classList.add("wire-concentration-card");
        }
        if (message.getFlag("wire", "isDeathSaveCard")) {
            html[0].classList.add("wire-death-save-card");
        }
        if (message.getFlag("wire", "isConditionCard")) {
            if (message.getFlag("wire", "wasUpdated")) {
                html[0].classList.remove("wire-hidden-condition-card");
            } else {
                html[0].classList.add("wire-hidden-condition-card");
            }
        }
    });

    async function teardownMasterEffect(effect, clean) {
        await runInQueue(async () => {
            const templateUuid = effect.getFlag("wire", "templateUuid");
            if (templateUuid) {
                const template = fromUuid(templateUuid);
                await template?.delete();
            }
    
            const childEffectUuids = effect.getFlag("wire", "childEffectUuids");
            if (childEffectUuids && childEffectUuids.length) {
                for (let uuid of childEffectUuids) {
                    await fromUuid(uuid)?.delete();
                }
            }
    
            if (clean) {
                await effect.unsetFlag("wire", "templateUuid");
                await effect.unsetFlag("wire", "childEffectUuids");
                await effect.unsetFlag("wire", "isMasterEffect");
            }
        })
    }

    async function triggerTransferEffect(effect) {
        const condition = effect.flags.wire?.conditions?.find(c => c.condition === "effect-created");
        if (condition) {
            const updater = makeUpdater(condition, effect, fromUuid(effect.origin));
            await updater?.process();
        }
    }

    Hooks.on("preCreateActiveEffect", (effect, data, options, user) => {
        if (data.transfer) {
            effect.updateSource({
                "flags.wire.wasTransferred": true,
                "flags.wire.isMasterEffect": true
            });
        }
    });

    Hooks.on("createActiveEffect", async (effect, options, user) => {
        if (user === game.user.id && effect.flags.wire?.wasTransferred && isEffectEnabled(effect) && isActorEffect(effect) && getActorToken(effect.parent)) {
            await triggerTransferEffect(effect);
        }
    });

    Hooks.on("deleteActiveEffect", async (effect, options, user) => {
        if (game.user.isGM && isActorEffect(effect)) {
            // Master effect deleted
            if (effect.getFlag("wire", "isMasterEffect")) {
                teardownMasterEffect(effect);
            }
    
            // Turn update linked effect deleted
            const casterUuid = effect.getFlag("wire", "castingActorUuid");
            if (casterUuid) {
                const caster = fromUuid(casterUuid);
                const effectUuids = caster?.flags.wire?.turnUpdatedEffectUuids?.filter(uuid => uuid !== effect.uuid);
                caster.setFlag("wire", "turnUpdatedEffectUuids", effectUuids);
            }

            // Aura deleted
            if (isAuraEffect(effect)) {
                updateAuras();
            }

            const conditions = effect.flags.wire?.conditions?.filter(c => c.condition === "effect-ends") ?? [];
            for (let condition of conditions) {
                const item = fromUuid(effect.origin);
                const updater = makeUpdater(condition, effect, item);
                runInQueue(async () => {
                    await updater?.process();
                });
            }
        }
    });

    Hooks.on("updateActiveEffect", async (effect, changes, options, user) => {
        if (game.user.isGM && changes.disabled !== undefined && isAuraEffect(effect)) {
            updateAuras();
        }

        if (user === game.user.id && changes.disabled !== undefined && effect.flags.wire?.wasTransferred && isActorEffect(effect)) {
            if (isEffectEnabled(effect) && getActorToken(effect.parent)) {
                await effect.setFlag("wire", "isMasterEffect", true);
                await triggerTransferEffect(effect);
            } else {
                teardownMasterEffect(effect, true);
            }
        }
    });

    Hooks.on("createToken", async (tokenDoc, options, user) => {
        if (user === game.user.id) {
            const actor = tokenDoc.actor;

            const deletions = actor.effects
                .filter(e => e.flags.wire?.wasTransferred)
                .map(e => e.id);
            const additions = actor.items
                .map(item => {
                    return item.effects
                        .filter(e => e.transfer)
                        .map(e => e.toObject(false))
                        .map(data => {
                            return foundry.utils.mergeObject(data, {
                                "origin": item.uuid,
                                "disabled": tokenDoc.hidden
                            });
                        })
                    })
                .flatMap(e => e);

            if (deletions.length > 0) {
                runInQueue(actor.deleteEmbeddedDocuments.bind(actor), "ActiveEffect", deletions);
            }
            if (additions.length > 0) {
                runInQueue(actor.createEmbeddedDocuments.bind(actor), "ActiveEffect", additions);
            }
        }
    });

    Hooks.on("deleteToken", (tokenDoc, options, user) => {
        if (game.user.isGM) {
            const actor = tokenDoc.actor;

            actor.effects
                .filter(e => e.flags.wire?.isMasterEffect)
                .forEach(effect => {
                    teardownMasterEffect(effect);
                });
        }
    });

    Hooks.on("updateItem", (item, updates, options, user) => {
        if (!item.isOwned)
            return true;
        if (user !== game.user.id)
            return true;
        if (options.isAdvancement) {
            return;
        }

        const actor = item.parent;

        if (!updates.effects || !game.modules.get("dae")?.active) {
            const itemUuid = item.uuid;

            const deletions = actor.effects
                .filter(e => e.flags?.wire?.wasTransferred && e.origin === itemUuid)
                .map(e => e.id);
            const additions = item.effects
                .filter(e => e.flags?.wire?.wasTransferred || e.transfer)
                .map(e => e.toObject(false))
                .map(data => {
                    const updates = {
                        "flags.wire.wasTransferred": true,
                        "origin": itemUuid
                    };
                    if (game.modules.get("dae")?.active) {
                        updates["flags.dae.transfer"] = true;
                    }
                    return foundry.utils.mergeObject(data, updates);
                });

            if (deletions.length > 0) {
                runInQueue(actor.deleteEmbeddedDocuments.bind(actor), "ActiveEffect", deletions);
            }
            if (additions.length > 0) {
                runInQueue(actor.createEmbeddedDocuments.bind(actor), "ActiveEffect", additions);
            }
        }

        return true;
    });
    
    Hooks.on("deleteMeasuredTemplate", (template, options, user) => {
        if (template.user === game.user) {
            const attachedTokenId = template.getFlag("wire", "attachedTokenId");
            if (attachedTokenId) {
                const token = canvas.tokens.get(attachedTokenId);
                token?.document.unsetFlag("wire", "attachedTemplateId");
            }
        }
    });

    Hooks.on("updateToken", async (tokenDoc, change, options, userId) => {
        if (change.x || change.y) {
            const templateId = await tokenDoc.getFlag("wire", "attachedTemplateId");
            const template = canvas.templates.get(templateId);
            if (template && template.document.user === game.user) {
                const update = tokenDoc.object.getCenter(tokenDoc.x, tokenDoc.y);
                await template.document.update(update);
            }

            if (game.user.isGM) {
                updateAuras();
            }
        }
    });

    Hooks.on("createToken", () => {
        if (game.user.isGM) {
            updateAuras();
        }
    });

    let lastKnownRound;
    let lastKnownCombatantId;

    Hooks.on("updateCombat", async (combat, change, options, userId) => {
        if (game.user.isGM && combat.started) {
            if (combat.current.combatantId !== lastKnownCombatantId) {
                await updateCombatTurnEndConditions();
            }

            await runInQueue(async () => {
                await checkCombatDurations(combat);
            });

            if (change.round && change.round !== lastKnownRound && game.settings.get("wire", "round-change-notifications")) {
                ChatMessage.create({
                    content: await renderTemplate("modules/wire/templates/round-change-card.hbs", { round: change.round }),
                    whisper: null,
                    emote: true,
                    flags: { "wire.hideSpeakerFields": true }
                })
            }

            const combatant = combat.combatants.get(combat.current.combatantId);
            if (combat.current.combatantId !== lastKnownCombatantId && combatant) {
                await resetVisitedTemplates();

                if (combatant.isNPC && !combatant.isDefeated) {
                    if (game.settings.get("wire", "change-turn-control-npc")) {
                        combatant.token?.object?.control();
                    }
                    if (game.settings.get("wire", "change-turn-focus-npc")) {
                        canvas.animatePan({ x: combatant.token?._object?.x, y: combatant.token?._object?.y })
                    }
                }
    
                if (!combatant.isDefeated && game.settings.get("wire", "turn-change-notifications")) {
                    const revealNpcs = game.settings.get("wire", "reveal-npc-turn-change");
                    const isHidden = combatant.hidden
                    const shouldWhisper = combatant.isNPC && (!revealNpcs || isHidden);

                    ChatMessage.create({
                        content: await renderTemplate("modules/wire/templates/turn-change-card.hbs", { token: combatant.token.object }),
                        whisper: shouldWhisper ? [game.user.id] : null,
                        emote: true,
                        flags: { "wire.hideSpeakerFields": true }
                    })              
                }

                const death = combatant.actor?.system.attributes.death;
                const needsDeathSave = !combatant.isNPC && combatant.actor?.system.attributes.hp.value == 0 && death?.failure < 3 && death?.success < 3;
                if (needsDeathSave) {
                    const card = new DeathSaveCard(combatant.actor);
                    await card.make();
                }
    
                await updateCombatTurnStartConditions();
            }

            lastKnownRound = combat.round;
            lastKnownCombatantId = combat.current.combatantId;
        }
    });

    Hooks.on("ready", () => {
        if (game.modules.get("dae")?.active) {
            DAE.addAutoFields(getWireFlags());
        }
    });

    Hooks.on("getChatLogEntryContext", (html, entryOptions) => {
        entryOptions.push(
            {
                name: "wire.ui.declare-roll-as-damage-targeted",
                icon: '<i class="fas fa-tint"></i>',
                condition: li => {
                    const message = game.messages.get(li.data("messageId"));
                    return message.isRoll && game.user.targets.size > 0;
                },
                callback: li => {
                    const message = game.messages.get(li.data("messageId"));
                    const actors = [...game.user.targets];
                    declareDamage(message.rolls, actors);
                }
            },
            {
                name: "wire.ui.declare-roll-as-damage-selected",
                icon: '<i class="fas fa-tint"></i>',
                condition: li => {
                    const message = game.messages.get(li.data("messageId"));
                    return message.isRoll && game.user.targets.size === 0 && canvas.tokens.controlled.length > 0;
                },
                callback: li => {
                    const message = game.messages.get(li.data("messageId"));
                    const actors = canvas.tokens.controlled;
                    declareDamage(message.rolls, actors);
                }
            },

            {
                name: "wire.ui.recreate-template",
                icon: '<i class="fas fa-ruler-combined"></i>',
                condition: li => {
                    const message = game.messages.get(li.data("messageId"));
                    const masterEffectUuid = message?.flags.wire?.activation?.masterEffectUuid;
                    const effect = fromUuid(masterEffectUuid);
                    if (effect) {
                        const item = fromUuid(effect.origin);
                        const template = fromUuid(effect.flags.wire?.templateUuid);
                        return item.hasAreaTarget && !template;
                    }
                },
                callback: async li => {
                    const message = game.messages.get(li.data("messageId"));
                    const activation = new Activation(message);
                    if (activation) {
                        const item = activation.item;
                        const template = fromUuid(activation.templateUuid);
                        if (item.hasAreaTarget && !template) {
                            const templateData = await createTemplate(item, activation.config, activation.applicationType, { disableTargetSelection: true });
                            if (templateData) {
                                await activation._assignTemplateData(templateData);
                                await activation._finalizeUpdate();
                            }
                        }
                    }
                }
            }
        );
    });

    Hooks.on("renderAbilityUseDialog", async (app, html) => {
        if (isItemActorOnCanvas(app.item)) {
            html.find('input[name="createMeasuredTemplate"]').closest('.form-group').remove();
            html.css({ height: '' });
            app.setPosition();
        }
    });

    Hooks.on("actorItemHoverIn", async (item, html) => {
        const components = getDisplayableAttackComponents(item, true);
        const target = game.user.targets.first()?.actor;
        const options = getStaticAttackOptions(item, target);
        const mode = options.advantage ? "advantage" : (options.disadvantage ? "disadvantage" : "");

        if (components) {
            const chatForm = $('#chat-form');
            const modeHtml = mode ? `
                <div class="attack-bonus-mode ${mode}">
                    ${i18n(`wire.roll-component.${mode}`)}
                </div>
            ` : "";
            const componentHtml = Object.values(components).map(c => {
                return `
                    <div class="attack-bonus-component">
                        <div class="attack-bonus-value">${c.value}</div>
                        <div class="attack-bonus-label">${i18n(c.i18nKey)}</div>
                    </div>
                `;
            })
            const html = `
                <div id="item-attack-bonuses">
                    ${modeHtml}
                    <div class="attack-bonus-components">
                        ${componentHtml.join("")}
                    </div>
                </div>
            `;

            $('#item-attack-bonuses').remove();
            chatForm.append(html);
        }
    });

    Hooks.on("actorItemHoverOut", (item, html) => {
        $('#item-attack-bonuses').remove();
    });

// Hooks.on("dfreds-convenient-effects.ready", () => {
//     console.log(arguments);
    
//     const original = game.dfreds.effects;

//     const handler = {
//         get(target, prop, receiver) {
//             if (prop === "spells" || prop === "classFeatures") {
//                 return [];
//             }
//             return Reflect.get(...arguments);
//         },
//     };

//     game.dfreds.effects = new Proxy(original, handler);
// });
}

async function declareDamage(rolls, tokens) {
    const damage = tokens.map(token => {
        return {
            actor: token.actor,
            token,
            points: { damage: rolls.map(r => r.total).reduce((a, b) => a + b, 0) }
        }
    });

    const pcDamage = damage.filter(d => d.actor.hasPlayerOwner);
    const npcDamage = damage.filter(d => !d.actor.hasPlayerOwner);

    if (pcDamage.length) {
        await DamageCard.make(null, pcDamage);
    }
    if (npcDamage.length) {
        await DamageCard.make(null, npcDamage);
    }
}

// Jump some hoops to safely clear linked messages even when clearing the chat log
const requestProcessRemovalQueue = debounce(processRemovalQueue, 100);
let removeQueue = [];

async function removeLinkedMessage(uuid) {
    if (!removeQueue.includes(uuid)) {
        removeQueue.push(uuid);
        requestProcessRemovalQueue();
    }
}

async function processRemovalQueue() {
    for (let uuid of removeQueue) {
        if (uuid) {
            const msg = fromUuid(uuid);
            if (msg) {
                await msg.update({ 'flags.wire': {} });
                await msg.delete();
            }
        }
    }
    removeQueue = [];
}

async function updateAuras() {
    const tokens = canvas.tokens.objects.children;
    const auraSources = tokens.flatMap(token => {
        return token.actor.effects
            .filter(effect => isEffectEnabled(effect) && isAuraEffect(effect))
            .map(effect => {
                return {
                    token, effect
                };
            });
    });
    let auraEffects = tokens.flatMap(token => {
        return token.actor.effects.filter(effect => isAuraTargetEffect(effect))
    });

    for (let source of auraSources) {
        const item = fromUuid(source.effect.origin);
        const auraToken = source.token;
        const sourceUuid = source.effect.uuid;

        const rollData = foundry.utils.mergeObject(item.getRollData(), item.flags.wire?.activationConfig || {});
        const targetValue = getProperty(item, "flags.wire.override.target.value") || getProperty(item, "system.target.value");
        if (targetValue) {
            let range = evaluateFormula(targetValue, rollData);
            if (item.system.target?.units == "rect") {
                range = Math.hypot(range, range);
            }

            auraEffects = auraEffects.filter(e => e.flags.wire?.auraSourceUuid !== sourceUuid)
            
            if (range) {
                const disposition = source.effect.flags.wire.auraTargets;
                let targets = [];

                for (let token of tokens) {
                    const isInRange = tokenSeparation(auraToken, token) <= range;
                    const existingEffect = token.actor.effects.find(effect => effect.origin === source.effect.origin)

                    if (!isInRange && existingEffect) {
                        await existingEffect.delete();
                    } else if (isInRange && !existingEffect) {
                        let dispositionCheck = false;
                        if (disposition === "ally" && areAllied(auraToken.actor, token.actor)) { dispositionCheck = true; }
                        else if (disposition === "enemy" && areEnemies(auraToken.actor, token.actor)) { dispositionCheck = true; }
                        else if (disposition === "creature") { dispositionCheck = true; }

                        if (dispositionCheck) {
                            targets.push(token.actor);
                        }
                    }
                }

                if (targets.length) {
                    const masterEffectUuid = source.effect.flags.wire?.masterEffectUuid;
                    const masterEffect = masterEffectUuid ? fromUuid(masterEffectUuid) : null;
                    const extraData = {
                        "flags.wire.auraSourceUuid": source.effect.uuid
                    }
                    await applySingleEffect(source.effect, targets, masterEffect, {}, extraData);
                }
            }
        }
    }

    for (let effect of auraEffects) {
        await effect.delete();
    }
}
