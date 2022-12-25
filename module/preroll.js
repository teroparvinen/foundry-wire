import { hasSaveableApplicationsOfType, isAttack, isSelfTarget } from "./item-properties.js";
import { createTemplate } from "./templates.js";
import { localizedWarning, runAndAwait } from "./utils.js";

export function preRollCheck(item) {
    if (isAttack(item) && !item.hasAreaTarget && game.user.targets.size != 1) {
        return localizedWarning("wire.warn.select-single-target-for-attack");
    } else if (!isSelfTarget(item) && hasSaveableApplicationsOfType(item, "immediate") && !item.hasAreaTarget && game.user.targets.size == 0) {
        return localizedWarning("wire.warn.select-targets-for-effect");
    }

    return true;  
}

export async function preRollConfig(item, options = {}, event) {
    const id = item.system;                // Item system data
    const actor = item.actor;
    const ad = actor.system;               // Actor system data

    let activationConfig = foundry.utils.mergeObject({}, options.config || {});

    // Reference aspects of the item data necessary for usage
    const hasArea = item.hasAreaTarget;       // Is the ability usage an AoE?
    const resource = id.consume || {};        // Resource consumption
    const recharge = id.recharge || {};       // Recharge mechanic
    const uses = id?.uses ?? {};              // Limited uses
    const isSpell = item.type === "spell";    // Does the item require a spell slot?
    const requireSpellSlot = isSpell && (id.level > 0) && CONFIG.DND5E.spellUpcastModes.includes(id.preparation.mode);

    // Define follow-up actions resulting from the item usage
    let doCreateMeasuredTemplate = hasArea && !options.skipTemplatePlacement;       // Trigger a template creation
    let doConsumeRecharge = !!recharge.value;     // Consume recharge
    let doConsumeResource = !!resource.target && (!item.hasAttack || (resource.type !== "ammo")); // Consume a linked (non-ammo) resource
    let consumedUsageCount = uses.per ? 1 : 0;              // Consume limited uses
    let consumedItemQuantity = uses.autoDestroy;     // Consume quantity of the item in lieu of uses
    let consumedSpellLevel = null;               // Consume a specific category of spell slot
    if (requireSpellSlot) consumedSpellLevel = id.preparation.mode === "pact" ? "pact" : `spell${id.level}`;

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
    if (requireSpellSlot) {
        activationConfig.spellLevel = id.level;
        activationConfig.upcastLevel = 0;
    }

    const useConfig = {
        doConsumeRecharge, doConsumeResource, consumedSpellLevel, consumedUsageCount, consumedItemQuantity
    };
    
    if (options.customConfigurationCallback) {
        const cbResult = await runAndAwait(options.customConfigurationCallback, item, useConfig);

        if (cbResult) {
            activationConfig = foundry.utils.mergeObject(activationConfig, cbResult || {});
        } else {
            return;
        }
    }

    // Display a configuration dialog to customize the usage
    const needsConfiguration =
        doConsumeRecharge || doConsumeResource || requireSpellSlot || useConfig.consumedUsageCount;
    if (needsConfiguration && !options.skipConfigurationDialog && !useConfig.skipDefaultDialog) {
        const configuration = await game.dnd5e.applications.item.AbilityUseDialog.create(item);
        if (!configuration) return;

        // Determine consumption preferences
        useConfig.consumedUsageCount = Boolean(configuration.consumeUsage) ? 1 : 0;
        useConfig.doConsumeRecharge = Boolean(configuration.consumeRecharge);
        useConfig.doConsumeResource = Boolean(configuration.consumeResource);

        // Handle spell upcasting
        if (requireSpellSlot) {
            useConfig.consumedSpellLevel = configuration.consumeSpellLevel === "pact" ? "pact" : `spell${configuration.consumeSpellLevel}`;
            if (configuration.consumeSpellSlot === false) useConfig.consumedSpellLevel = null;
            const upcastLevel = configuration.consumeSpellLevel === "pact" ? ad.spells.pact.level : parseInt(configuration.consumeSpellLevel);

            activationConfig.spellLevel = upcastLevel;
            activationConfig.upcastLevel = upcastLevel - id.level;
        }
    }

    // Determine whether the item can be used by testing for resource consumption
    const usage = getUsageUpdates(item, useConfig);
    if (!usage) return;
    const { actorUpdates, itemUpdates, resourceUpdates } = usage;

    // Commit pending data updates
    if (!foundry.utils.isEmpty(itemUpdates)) await item.update(itemUpdates);
    if (consumedItemQuantity && (item.system.quantity === 0)) { activationConfig.deleteItem = true }
    if (!foundry.utils.isEmpty(actorUpdates)) await actor.update(actorUpdates);
    if (resourceUpdates.length) await actor.updateEmbeddedDocuments("Item", resourceUpdates);

    // Initiate measured template creation
    let templateData;
    if (doCreateMeasuredTemplate) {
        templateData = await createTemplate(item, activationConfig, "immediate", options);
        if (!templateData) { return; }
    }

    // Create or return the Chat Message data
    const messageData = await item.displayCard({ rollMode: null, createMessage: false });

    return {
        messageData: messageData,
        config: activationConfig,
        templateData
    };
}

function getUsageUpdates(item, { doConsumeRecharge, doConsumeResource, consumedSpellLevel, consumedUsageCount, consumedItemQuantity }) {

    // Reference item data
    const id = item.system;
    const actorUpdates = {};
    const itemUpdates = {};
    const resourceUpdates = [];

    // Consume Recharge
    if (doConsumeRecharge) {
        const recharge = id.recharge || {};
        if (recharge.charged === false) {
            ui.notifications.warn(game.i18n.format("DND5E.ItemNoUses", { name: item.name }));
            return false;
        }
        itemUpdates["system.recharge.charged"] = false;
    }

    // Consume Limited Resource
    if (doConsumeResource) {
        const canConsume = item._handleConsumeResource(itemUpdates, actorUpdates, resourceUpdates);
        if (canConsume === false) return false;
    }

    // Consume Spell Slots
    if (consumedSpellLevel) {
        if (Number.isNumeric(consumedSpellLevel)) consumedSpellLevel = `spell${consumedSpellLevel}`;
        const level = item.actor?.system.spells[consumedSpellLevel];
        const spells = Number(level?.value ?? 0);
        if (spells === 0) {
            const label = game.i18n.localize(consumedSpellLevel === "pact" ? "DND5E.SpellProgPact" : `DND5E.SpellLevel${id.level}`);
            ui.notifications.warn(game.i18n.format("DND5E.SpellCastNoSlots", { name: item.name, level: label }));
            return false;
        }
        actorUpdates[`system.spells.${consumedSpellLevel}.value`] = Math.max(spells - 1, 0);
    }

    // Consume Limited Usage
    if (consumedUsageCount) {
        const uses = id.uses || {};
        const available = Number(uses.value ?? 0);
        let used = false;

        // Reduce usages
        const remaining = Math.max(available - consumedUsageCount, 0);
        if (available >= consumedUsageCount) {
            used = true;
            itemUpdates["system.uses.value"] = remaining;
        }

        // Reduce quantity if not reducing usages or if usages hit 0 and we are set to consumeQuantity
        if (consumedItemQuantity && (!used || (remaining === 0))) {
            const q = Number(id.quantity ?? 1);
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
