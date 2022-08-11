import { initAreaConditionHooks } from "./conditions/area-effects.js";
import { initCombatTurnConditionHooks } from "./conditions/combat-turns.js";
import { DamageParts } from "./game/damage-parts.js";
import { registerHandlebarsHelpers } from "./handlebars.js";
import { initHooks } from "./hooks.js";
import { initActiveEffectSheetHooks, setupActiveEffectSheetWrappers } from "./injections/active-effect-sheet.js";
import { initItemSheetHooks, setupItemSheetWrappers } from "./injections/item-sheet.js";
import { setupSocket } from "./socket.js";
import { setupWrappers } from "./wrappers.js";

Hooks.once("init", () => {
    initHooks();
    registerHandlebarsHelpers();

    initItemSheetHooks();
    initActiveEffectSheetHooks();

    initCombatTurnConditionHooks();
    initAreaConditionHooks();

    game.wire = {
        DamageParts
    }
});

Hooks.once("setup", () => {
    setupWrappers();
    setupItemSheetWrappers();
    setupActiveEffectSheetWrappers();
    setupSocket();
});
