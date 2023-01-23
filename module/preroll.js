import { hasSaveableApplicationsOfType, isAreaTargetable, isAttack, isSelfTarget } from "./item-properties.js";
import { createTemplate } from "./templates.js";
import { isCharacterActor, localizedWarning, runAndAwait } from "./utils.js";

export function preRollCheck(item) {
    if (isAttack(item) && !item.hasAreaTarget && game.user.targets.size != 1) {
        return localizedWarning("wire.warn.select-single-target-for-attack");
    } else if (isAttack(item) && !item.hasAreaTarget && !isCharacterActor(game.user.targets.first()?.actor)) {
        return localizedWarning("wire.warn.select-character-target-for-attack");
    } else if (!isSelfTarget(item) && hasSaveableApplicationsOfType(item, "immediate") && !item.hasAreaTarget && game.user.targets.size == 0) {
        return localizedWarning("wire.warn.select-targets-for-effect");
    }

    return true;  
}

export async function preRollConfig(item, options = {}, event) {
    const actor = item.actor;
    const is = item.system;                // Item system data
    const as = actor.system;               // Actor system data

    const isSpell = item.type === "spell";    // Does the item require a spell slot?

    // Activation config
    let activationConfig = foundry.utils.mergeObject({}, options.config || {});

    if (options.variantOptions && !options.variant && !options.skipVariantSelection) {
        const variant = await new game.wire.SelectVariantDialog(item, options.variantOptions).render(true);
        if (!variant) {
            return;
        }
        activationConfig.variant = variant;
    } else {
        activationConfig.variant = options.variant;
    }
    activationConfig.variantOptions = options.variantOptions;
    if (isSpell) {
        activationConfig.spellLevel = is.level;
        activationConfig.upcastLevel = 0;
    }

    // Reference aspects of the item data necessary for usage
    const resource = is.consume || {};        // Resource consumption
    const requireSpellSlot = isSpell && (is.level > 0) && CONFIG.DND5E.spellUpcastModes.includes(is.preparation.mode);
    const createMeasuredTemplate = isAreaTargetable(item) && !options.skipTemplatePlacement;

    // Define follow-up actions resulting from the item usage
    const useConfig = {
        createMeasuredTemplate: isAreaTargetable(item),
        consumeQuantity: is.uses?.autoDestroy ?? false,
        consumeRecharge: !!is.recharge?.value,
        consumeResource: !!resource.target && (!item.hasAttack || (resource.type !== "ammo")),
        consumeSpellLevel: requireSpellSlot ? is.preparation.mode === "pact" ? "pact" : is.level : null,
        consumeSpellSlot: requireSpellSlot,
        consumeUsage: !!is.uses?.per
    };
    const hookOptions = {
        activationConfig,
        flags: {}
    };

    // Display a configuration dialog to customize the usage
    useConfig.needsConfiguration = useConfig.consumeRecharge || useConfig.consumeResource || useConfig.consumeSpellSlot || useConfig.consumeUsage;

    if (options.customConfigurationCallback) {
        const cbResult = await runAndAwait(options.customConfigurationCallback, item, useConfig);

        if (cbResult) {
            activationConfig = foundry.utils.mergeObject(activationConfig, cbResult || {});
        } else {
            return;
        }
    }

    if (Hooks.call("dnd5e.preUseItem", item, useConfig, hookOptions) === false ) return;

    // Display configuration dialog
    if (useConfig.needsConfiguration && !options.skipConfigurationDialog && !useConfig.skipDefaultDialog) {
        const configuration = await game.dnd5e.applications.item.AbilityUseDialog.create(item);
        if (!configuration) return;
        foundry.utils.mergeObject(useConfig, configuration);
    }

    // Handle spell upcasting
    if (isSpell && (useConfig.consumeSpellSlot || useConfig.consumeSpellLevel)) {
        const upcastLevel = useConfig.consumeSpellLevel === "pact" ? as.spells.pact.level : parseInt(useConfig.consumeSpellLevel);
        if (upcastLevel && (upcastLevel !== is.level)) {
            activationConfig.spellLevel = upcastLevel;
            activationConfig.upcastLevel = upcastLevel - is.level;
        }
    }

    if (Hooks.call("dnd5e.preItemUsageConsumption", item, useConfig, hookOptions) === false) return;
    
    // Determine whether the item can be used by testing for resource consumption
    const usage = _getUsageUpdates(item, useConfig);
    if (!usage) return;

    if (Hooks.call("dnd5e.itemUsageConsumption", item, useConfig, hookOptions, usage) === false) return;

    // Commit pending data updates
    const { actorUpdates, itemUpdates, resourceUpdates } = usage;
    if (!foundry.utils.isEmpty(itemUpdates)) await item.update(itemUpdates);
    if (useConfig.consumeQuantity && (item.system.quantity === 0)) { activationConfig.deleteItem = true }
    if (!foundry.utils.isEmpty(actorUpdates)) await actor.update(actorUpdates);
    if (resourceUpdates.length) await actor.updateEmbeddedDocuments("Item", resourceUpdates);


    // Initiate measured template creation
    let templateData;
    if (createMeasuredTemplate) {
        templateData = await createTemplate(item, activationConfig, "immediate", options);
        if (!templateData) { return; }
    }

    // Create or return the Chat Message data
    const messageData = await item.displayCard({ rollMode: null, createMessage: false });

    Hooks.callAll("dnd5e.useItem", item, useConfig, hookOptions, null);

    return {
        messageData: messageData,
        config: activationConfig,
        templateData
    };
}

// Custom version allowing more than 1 usages to be spent
function _getUsageUpdates(item, { consumeQuantity, consumeRecharge, consumeResource, consumeSpellSlot, consumeSpellLevel, consumeUsage, consumedUsageCount=1}) {
    const actorUpdates = {};
    const itemUpdates = {};
    const resourceUpdates = [];

    // Consume Recharge
    if (consumeRecharge) {
        const recharge = item.system.recharge || {};
        if (recharge.charged === false) {
            ui.notifications.warn(game.i18n.format("DND5E.ItemNoUses", { name: item.name }));
            return false;
        }
        itemUpdates["system.recharge.charged"] = false;
    }

    // Consume Limited Resource
    if (consumeResource) {
        const canConsume = item._handleConsumeResource(itemUpdates, actorUpdates, resourceUpdates);
        if (canConsume === false) return false;
    }

    // Consume Spell Slots
    if (consumeSpellSlot && consumeSpellLevel) {
        if (Number.isNumeric(consumeSpellLevel)) consumeSpellLevel = `spell${consumeSpellLevel}`;
        const level = item.actor?.system.spells[consumeSpellLevel];
        const spells = Number(level?.value ?? 0);
        if (spells === 0) {
            const labelKey = consumeSpellLevel === "pact" ? "DND5E.SpellProgPact" : `DND5E.SpellLevel${item.system.level}`;
            const label = game.i18n.localize(labelKey);
            ui.notifications.warn(game.i18n.format("DND5E.SpellCastNoSlots", { name: item.name, level: label }));
            return false;
        }
        actorUpdates[`system.spells.${consumeSpellLevel}.value`] = Math.max(spells - 1, 0);
    }

    // Consume Limited Usage
    if (consumeUsage) {
        const uses = item.system.uses || {};
        const available = Number(uses.value ?? 0);
        let used = false;
        const remaining = Math.max(available - consumedUsageCount, 0);
        if (available >= consumedUsageCount) {
            used = true;
            itemUpdates["system.uses.value"] = remaining;
        }

        // Reduce quantity if not reducing usages or if usages hit zero, and we are set to consumeQuantity
        if (consumeQuantity && (!used || (remaining === 0))) {
            const q = Number(item.system.quantity ?? 1);
            if (q >= 1) {
                used = true;
                itemUpdates["system.quantity"] = Math.max(q - 1, 0);
                itemUpdates["system.uses.value"] = uses.max ?? 1;
            }
        }

        // If the item was not used, return a warning
        if (!used) {
            ui.notifications.warn(game.i18n.format("DND5E.ItemNoUses", { name: item.name }));
            return false;
        }
    }

    // Return the configured usage
    return { itemUpdates, actorUpdates, resourceUpdates };
}
