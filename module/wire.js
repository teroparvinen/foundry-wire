import { runInQueue, setupActionQueue } from "./action-queue.js";
import { SelectVariantDialog } from "./apps/select-variant.js";
import { initAreaConditionHooks } from "./conditions/area-effects.js";
import { initRegularRollHooks } from "./conditions/regular-rolls.js";
import { DamageParts } from "./game/damage-parts.js";
import { DamageCard } from "./cards/damage-card.js";
import { initEffectFlagHooks, setupRollFlagWrappers } from "./game/effect-flags.js";
import { registerHandlebarsHelpers } from "./handlebars.js";
import { initHooks } from "./hooks.js";
import { initActiveEffectSheetHooks, setupActiveEffectSheetWrappers } from "./injections/active-effect-sheet.js";
import { readyCharacterSheetWrappers } from "./injections/character-sheet.js";
import { initItemSheetHooks, setupItemSheetWrappers } from "./injections/item-sheet.js";
import { setupKeybindings } from "./keybindings.js";
import { setupSocket } from "./socket.js";
import { setupWrappers } from "./wrappers.js";
import { createScrollingText, fromUuid, getActorToken } from "./utils.js";
import { createChildEffects, removeChildEffects } from "./game/active-effects.js";
import { initSettings } from "./settings.js";
import { getAvailablePackImports, importPackItems, setupCompendiumHooks } from "./compendiums.js";
import { initTemplateHooks, placeTemplate, setupTemplateWrappers } from "./templates.js";
import { setupLogicRolls } from "./logic-rolls.js";

Hooks.once("init", () => {
    initHooks();
    registerHandlebarsHelpers();

    initSettings();

    initItemSheetHooks();
    initActiveEffectSheetHooks();
    initTemplateHooks();

    initAreaConditionHooks();
    initRegularRollHooks();

    initEffectFlagHooks();

    game.wire = {
        DamageParts,
        DamageCard,
        SelectVariantDialog,
        placeTemplate,
        runInQueue,
        fromUuid,
        getActorToken,
        removeChildEffects,
        createChildEffects,
        createScrollingText,
        getAvailablePackImports,
        importPackItems
    }
});

Hooks.once("setup", () => {
    setupWrappers();
    setupItemSheetWrappers();
    setupActiveEffectSheetWrappers();
    setupRollFlagWrappers();
    setupTemplateWrappers();
    setupSocket();
    setupActionQueue();
    setupKeybindings();
    setupCompendiumHooks();
    setupLogicRolls();
});

Hooks.once("ready", async () => {
    readyCharacterSheetWrappers();

    await checkBetaWarning();
    await checkItemMacroSettings();
});

async function checkBetaWarning() {
    if (game.user.isGM && !game.settings.get("wire", "beta-warning-displayed")) {
        await Dialog.confirm({
            title: game.i18n.localize("wire.beta-warning.title"),
            content: game.i18n.localize("wire.beta-warning.content"),
            yes: () => { game.settings.set("wire", "beta-warning-displayed", true) },
            no: () => {},
            defaultYes: false
        });
    }
}

async function checkItemMacroSettings() {
    if (game.user.isGM && game.modules.get("itemacro")?.active && (game.settings.get("itemacro", "charsheet") || game.settings.get("itemacro", "defaultmacro"))) {
        await Dialog.confirm({
            title: game.i18n.localize("wire.module-check.itemacro-title"),
            content: game.i18n.localize("wire.module-check.itemacro-content"),
            yes: () => {
                game.settings.set("itemacro", "charsheet", false);
                game.settings.set("itemacro", "defaultmacro", false);
                setTimeout(() => window.location.reload(), 500);
            },
            no: () => {},
            defaultYes: true
        });
    }
}
