import { ActorItemCompendiumConfig } from "./apps/compendium-actor-item.js";
import { ActorCompendiumUpgrade } from "./apps/compendium-actor.js";
import { PackItemCompendiumConfig } from "./apps/compendium-pack-item.js";

export function setupCompendiumHooks() {
    Hooks.on("getActorSheet5eCharacterHeaderButtons", (app, buttons) => {
        buttons.unshift({
            class: "wire-compendium-button",
            icon: "fas fa-plug",
            // label: game.i18n.localize(`Foo`),
            onclick: () => {
                new ActorCompendiumUpgrade(app.object).render(true);
            }
        });
    });

    Hooks.on("getItemSheetHeaderButtons", (app, buttons) => {
        buttons.unshift({
            class: "wire-compendium-button",
            icon: "fas fa-plug",
            onclick: () => {
                const item = app.object;
                if (item.pack) {
                    const app = new PackItemCompendiumConfig(item);
                    app.render(true);
                } else {
                    const app = new ActorItemCompendiumConfig(item);
                    app.render(true);
                }
            }
        });
    });

    Hooks.on("createItem", (item, context, user) => {
        if (item.pack) {
            const pack = game.packs.get(item.pack);

            if (pack.metadata.flags.wireImport) {
                const module = game.modules.get(pack.metadata.packageName);

                item.update({
                    "flags.wire.compendiumSource": item.pack,
                    "flags.wire.compendiumVersion": module.version
                });
            }
        }
    })
}