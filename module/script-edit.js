import { EditScript } from "./apps/edit-script.js";

export function setupScriptEditHooks() {
    Hooks.on("getItemSheet5eHeaderButtons", (app, buttons) => {
        buttons.unshift({
            class: "wire-script-button",
            icon: "fas fa-scroll",
            label: game.i18n.localize("wire.ui.edit-script"),
            onclick: () => {
                new EditScript(app.object).render(true);
            }
        });
    });
}
