import { ActorItemCompendiumConfig } from "./apps/compendium-actor-item.js";
import { ActorCompendiumUpgrade } from "./apps/compendium-actor.js";
import { PackItemCompendiumConfig } from "./apps/compendium-pack-item.js";

export function setupCompendiumHooks() {
    Hooks.on("getActorSheet5eHeaderButtons", (app, buttons) => {
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

export function getAvailablePacks() {
    return game.packs.contents
        .filter(p => game.user.isGM || !p.private)
        .filter(p => p.metadata.type === "Item")
        .filter(p => p.metadata.flags.wireImport);
}

async function getAvailablePackItems() {
    return Promise.all(getAvailablePacks().map(async pack => {
        const documents = await pack.getDocuments();
        return { pack, documents };
    }));
}

export async function getAvailablePackImports(actor) {
    if (!(actor instanceof CONFIG.Actor.documentClass)) {
        throw new Error("Expected an actor as a parameter");
    }

    const upgradeableItems = [];
    const replaceableItems = [];
    
    const packItems = await getAvailablePackItems();

    actor.items.forEach(actorItem => {
        const itemPack = actorItem.flags.wire?.compendiumSource;
        const itemVersion = actorItem.flags.wire?.compendiumVersion;

        if (itemPack) {
            const packItem = packItems
                .find(pi => pi.pack.metadata.id === itemPack).documents
                .find(packItem =>
                    packItem.flags.wire?.compendiumVersion &&
                    packItem.name === actorItem.name && 
                    (!itemVersion || 
                     foundry.utils.isNewerVersion(packItem.flags.wire.compendiumVersion, itemVersion))
                );

            if (packItem) {
                upgradeableItems.push({
                    actorItem, packItem
                });
            }
        } else {
            const items = packItems
                .flatMap(pi => pi.documents)
                .filter(packItem =>
                    packItem.name === actorItem.name &&
                    packItem.type === actorItem.type
                );
            if (items.length) {
                replaceableItems.push(...items.map(packItem => ({ actorItem, packItem })));
            }
        }

    });

    return { upgradeableItems, replaceableItems };
}

export async function importPackItems(actor, entries) {
    if (!(actor instanceof CONFIG.Actor.documentClass)) {
        throw new Error("Expected an actor as a parameter");
    }

    const toDelete = [];
    const toCreate = [];

    for (const entry of entries) {
        if (!(entry.packItem instanceof CONFIG.Item.documentClass) || !(entry.actorItem instanceof CONFIG.Item.documentClass)) {
            throw new Error("Expected an array of objects with Item5e values keyed 'packItem' and 'actorItem'.");
        }
        if (entry.actorItem.actor !== actor) {
            throw new Error("Can't import items not owned by the target actor");
        }

        const incoming = entry.packItem.toObject();
        const outgoing = entry.actorItem.toObject();

        const { sort, img } = outgoing;
        const { preparation, uses, description } = outgoing.system;

        Object.assign(incoming.system, { preparation, uses });
        Object.assign(incoming, { sort });

        if (!incoming.system.description.value) { Object.assign(incoming.system, { description }); };
        if (!incoming.img) { Object.assign(incoming, { img }); };

        toDelete.push(entry.actorItem.id);
        toCreate.push(incoming);
    }

    await actor.deleteEmbeddedDocuments("Item", toDelete);
    await actor.createEmbeddedDocuments("Item", toCreate);
}