import { runInQueue, setupActionQueue } from "./action-queue.js";
import { SelectVariantDialog } from "./apps/select-variant.js";
import { initAreaConditionHooks } from "./conditions/area-effects.js";
import { initRegularRollHooks } from "./conditions/regular-rolls.js";
import { DamageParts } from "./game/damage-parts.js";
import { DamageCard, declareDamage, declareHealing } from "./cards/damage-card.js";
import { initEffectFlagHooks, setupRollFlagWrappers } from "./game/effect-flags.js";
import { registerHandlebarsHelpers } from "./handlebars.js";
import { initHooks } from "./hooks.js";
import { initActiveEffectSheetHooks, setupActiveEffectSheetWrappers } from "./injections/active-effect-sheet.js";
import { readyCharacterSheetWrappers } from "./injections/character-sheet.js";
import { initItemSheetHooks, setupItemSheetWrappers } from "./injections/item-sheet.js";
import { setupKeybindings } from "./keybindings.js";
import { setupSocket } from "./socket.js";
import { setupWrappers } from "./wrappers.js";
import { createScrollingText, fromUuid, fudgeToActor, fudgeToToken, getActorToken } from "./utils.js";
import { createChildEffects, removeChildEffects } from "./game/active-effects.js";
import { initSettings } from "./settings.js";
import { getAvailablePackImports, importPackItems, setupCompendiumHooks } from "./compendiums.js";
import { initTemplateHooks, placeTemplate, setupTemplateWrappers } from "./templates.js";
import { setupLogicRolls } from "./logic-rolls.js";
import { setupDurations } from "./durations.js";
import { requestConcentrationSave } from "./cards/concentration-card.js";

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

        asActor: fudgeToActor,
        asToken: fudgeToToken,
        createChildEffects,
        createScrollingText,
        declareDamage,
        declareHealing,
        fromUuid,
        getActorToken,
        placeTemplate,
        removeChildEffects,
        requestConcentrationSave,
        runInQueue,

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
    setupDurations();
});

Hooks.once("ready", async () => {
    game.wire.trackedActivationTypeProperties = {
        bonus: {
            condition: CONFIG.DND5E.abilityActivationTypes.bonus,
            setting: "track-bonus-actions"
        },
        reaction: {
            condition: CONFIG.DND5E.abilityActivationTypes.reaction,
            setting: "track-reactions"
        }
    }

    readyCharacterSheetWrappers();

    await checkBetaWarning();
    await checkItemMacroSettings();
    await checkTimesUpWarning();
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

async function checkTimesUpWarning() {
    if (game.user.isGM && game.modules.get("times-up")?.active) {
        await Dialog.confirm({
            title: game.i18n.localize("wire.module-check.times-up-title"),
            content: game.i18n.localize("wire.module-check.times-up-content"),
            yes: async () => {
                const settings = game.settings.get("core", ModuleManagement.CONFIG_SETTING);
                settings["times-up"] = false;
                await game.settings.set("core", ModuleManagement.CONFIG_SETTING, settings);
                setTimeout(() => window.location.reload(), 500);
            },
            no: () => {},
            defaultYes: true
        });
    }
}