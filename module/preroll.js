import AbilityUseDialog from "../../../systems/dnd5e/module/apps/ability-use-dialog.js";
import { isAttack, isSelfRange, targetsSingleToken } from "./item-properties.js";
import { getActorToken, localizedWarning, runAndAwait, setTemplateTargeting } from "./utils.js";

export function preRollCheck(item) {
    if (isAttack(item) && !item.hasAreaTarget && game.user.targets.size != 1) {
        return localizedWarning("wire.warn.select-single-target-for-attack");
    } else if (item.hasSave && !item.hasAreaTarget && game.user.targets.size == 0) {
        return localizedWarning("wire.warn.select-targets-for-effect");
    }

    return true;  
}

export async function preRollConfig(item, options = {}, event) {
    const id = item.data.data;                // Item system data
    const actor = item.actor;
    const ad = actor.data.data;               // Actor system data

    let activationConfig = {};

    // Reference aspects of the item data necessary for usage
    const hasArea = item.hasAreaTarget;       // Is the ability usage an AoE?
    const resource = id.consume || {};        // Resource consumption
    const recharge = id.recharge || {};       // Recharge mechanic
    const uses = id?.uses ?? {};              // Limited uses
    const isSpell = item.type === "spell";    // Does the item require a spell slot?
    const requireSpellSlot = isSpell && (id.level > 0) && CONFIG.DND5E.spellUpcastModes.includes(id.preparation.mode);

    // Define follow-up actions resulting from the item usage
    let doCreateMeasuredTemplate = hasArea;       // Trigger a template creation
    let doConsumeRecharge = !!recharge.value;     // Consume recharge
    let doConsumeResource = !!resource.target && (!item.hasAttack || (resource.type !== "ammo")); // Consume a linked (non-ammo) resource
    let doConsumeSpellSlot = requireSpellSlot;    // Consume a spell slot
    let consumedUsageCount = uses.per ? 1 : 0;              // Consume limited uses
    let consumedItemQuantity = uses.autoDestroy;     // Consume quantity of the item in lieu of uses
    let consumedSpellLevel = null;               // Consume a specific category of spell slot
    if (requireSpellSlot) consumedSpellLevel = id.preparation.mode === "pact" ? "pact" : `spell${id.level}`;

    if (options.variantOptions) {
        activationConfig.variant = await new game.wire.SelectVariantDialog(item, options.variantOptions).render(true);
    }

    const skipDefaultDialog = false;
    const useConfig = {
        doCreateMeasuredTemplate, doConsumeRecharge, doConsumeResource, doConsumeSpellSlot, 
        consumedSpellLevel, consumedUsageCount, consumedItemQuantity, skipDefaultDialog
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
        useConfig.doCreateMeasuredTemplate || useConfig.doConsumeRecharge || useConfig.doConsumeResource || 
        useConfig.doConsumeSpellSlot || useConfig.consumedUsageCount;
    if (needsConfiguration && !options.skipConfigurationDialog && !useConfig.skipDefaultDialog) {
        const configuration = await AbilityUseDialog.create(item);
        if (!configuration) return;

        // Determine consumption preferences
        doCreateMeasuredTemplate = Boolean(configuration.placeTemplate);
        consumedUsageCount = Boolean(configuration.consumeUse) ? 1 : 0;
        doConsumeRecharge = Boolean(configuration.consumeRecharge);
        doConsumeResource = Boolean(configuration.consumeResource);
        doConsumeSpellSlot = Boolean(configuration.consumeSlot);

        // Handle spell upcasting
        if (requireSpellSlot) {
            consumedSpellLevel = configuration.level === "pact" ? "pact" : `spell${configuration.level}`;
            if (doConsumeSpellSlot === false) useConfig.consumedSpellLevel = null;
            const upcastLevel = configuration.level === "pact" ? ad.spells.pact.level : parseInt(configuration.level);
            if (!Number.isNaN(upcastLevel) && (upcastLevel !== id.level)) {
                activationConfig.spellLevel = upcastLevel;
            }
        }
    }

    // Determine whether the item can be used by testing for resource consumption
    const usage = getUsageUpdates(item, useConfig);
    if (!usage) return;
    const { actorUpdates, itemUpdates, resourceUpdates } = usage;

    // Commit pending data updates
    if (!foundry.utils.isObjectEmpty(itemUpdates)) await item.update(itemUpdates);
    if (consumedItemQuantity && (item.data.data.quantity === 0)) await item.delete();
    if (!foundry.utils.isObjectEmpty(actorUpdates)) await actor.update(actorUpdates);
    if (resourceUpdates.length) await actor.updateEmbeddedDocuments("Item", resourceUpdates);

    // Initiate measured template creation
    let template;
    if (doCreateMeasuredTemplate) {
        if (isSelfRange(item) && item.hasAreaTarget && (item.data.data.target.type === "sphere" || item.data.data.target.type === "radius")) {
            const token = getActorToken(actor);
            if (token) {
                const destination = canvas.grid.getSnappedPosition(token.data.x, token.data.y, 2);
                destination.x = destination.x + token.w / 2;
                destination.y = destination.y + token.h / 2;
                const preTemplate = game.dnd5e.canvas.AbilityTemplate.fromItem(item);
                await preTemplate.data.update(destination);
                const created = await canvas.scene.createEmbeddedDocuments("MeasuredTemplate", [preTemplate.data.toObject()]);
                template = created[0];
                await token.document.setFlag("wire", "attachedTemplateId", template.id);
                await template.setFlag("wire", "attachedTokenId", token.id);
            }
        } else {
            const template = game.dnd5e.canvas.AbilityTemplate.fromItem(item);
            if (template) template.drawPreview();
            setTemplateTargeting(true);
        }
    }

    // Create or return the Chat Message data
    const messageData = await item.displayCard({ rollMode: null, createMessage: false });

    return {
        messageData: messageData,
        config: activationConfig,
        template
    };
}

function getUsageUpdates(item, { doConsumeRecharge, doConsumeResource, consumedSpellLevel, consumedUsageCount, consumedItemQuantity }) {

    // Reference item data
    const id = item.data.data;
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
        itemUpdates["data.recharge.charged"] = false;
    }

    // Consume Limited Resource
    if (doConsumeResource) {
        const canConsume = item._handleConsumeResource(itemUpdates, actorUpdates, resourceUpdates);
        if (canConsume === false) return false;
    }

    // Consume Spell Slots
    if (consumedSpellLevel) {
        if (Number.isNumeric(consumedSpellLevel)) consumedSpellLevel = `spell${consumedSpellLevel}`;
        const level = item.actor?.data.data.spells[consumedSpellLevel];
        const spells = Number(level?.value ?? 0);
        if (spells === 0) {
            const label = game.i18n.localize(consumedSpellLevel === "pact" ? "DND5E.SpellProgPact" : `DND5E.SpellLevel${id.level}`);
            ui.notifications.warn(game.i18n.format("DND5E.SpellCastNoSlots", { name: item.name, level: label }));
            return false;
        }
        actorUpdates[`data.spells.${consumedSpellLevel}.value`] = Math.max(spells - 1, 0);
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
            itemUpdates["data.uses.value"] = remaining;
        }

        // Reduce quantity if not reducing usages or if usages hit 0 and we are set to consumeQuantity
        if (consumedItemQuantity && (!used || (remaining === 0))) {
            const q = Number(id.quantity ?? 1);
            if (q >= 1) {
                used = true;
                itemUpdates["data.quantity"] = Math.max(q - 1, 0);
                itemUpdates["data.uses.value"] = uses.max ?? 1;
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
