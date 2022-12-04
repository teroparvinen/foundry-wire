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
import { placeTemplate } from "./preroll.js";
import { fromUuid } from "./utils.js";
import { createChildEffects, removeChildEffects } from "./game/active-effects.js";
import { initSettings } from "./settings.js";
import { setupCompendiumHooks } from "./compendiums.js";

Hooks.once("init", () => {
    initHooks();
    registerHandlebarsHelpers();

    initSettings();

    initItemSheetHooks();
    initActiveEffectSheetHooks();

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
        removeChildEffects,
        createChildEffects
    }
});

Hooks.once("setup", () => {
    setupWrappers();
    setupItemSheetWrappers();
    setupActiveEffectSheetWrappers();
    setupRollFlagWrappers();
    setupSocket();
    setupActionQueue();
    setupKeybindings();
    setupCompendiumHooks();
});

Hooks.once("ready", () => {
    readyCharacterSheetWrappers();

    checkBetaWarning();
});

function checkBetaWarning() {
    if (game.user.isGM && !game.settings.get("wire", "beta-warning-displayed")) {
        let d = Dialog.confirm({
            title: game.i18n.localize("wire.beta-warning.title"),
            content: game.i18n.localize("wire.beta-warning.content"),
            yes: () => { game.settings.set("wire", "beta-warning-displayed", true) },
            no: () => {},
            defaultYes: false
        });
    }
}