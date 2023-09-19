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
import { createScrollingText, fromUuid, fudgeToActor, fudgeToToken, getActorToken, getMasterEffect, isActivationTypeAvailable, markActivationTypeUsed } from "./utils.js";
import { createChildEffects, removeChildEffects } from "./game/active-effects.js";
import { initSettings } from "./settings.js";
import { getAvailablePackImports, importPackItems, setupCompendiumHooks } from "./compendiums.js";
import { initTemplateHooks, placeTemplate, setupTemplateWrappers } from "./templates.js";
import { setupLogicRolls } from "./logic-rolls.js";
import { setupDurations } from "./durations.js";
import { requestConcentrationSave } from "./cards/concentration-card.js";
import { initArbronSummonerHooks } from "./compatibility/arbron-summoner.js";
import { setupScriptEditHooks } from "./script-edit.js";
import { checkMigration } from "./migration.js";

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

    // Compatibility with other modules
    initArbronSummonerHooks();

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
        getMasterEffect,
        isActivationTypeAvailable,
        markActivationTypeUsed,
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
    setupScriptEditHooks();
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

    await checkMigration();

    await checkBetaWarning();
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