import { i18n } from "../utils.js";

export class ActorCompendiumUpgrade extends FormApplication {

    constructor(actor, options = {}) {
        super(actor, options);

        this.object = actor;

        (async () => {
            const packItems = await this.getAvailablePackItems();

            const upgradeableItems = [];
            const replaceableItems = [];

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
                            packItem.name === actorItem.name
                        );
                    if (items.length) {
                        replaceableItems.push(...items.map(packItem => ({ actorItem, packItem })));
                    }
                }

            });

            this.packItems = packItems;
            this.upgradeableItems = upgradeableItems;
            this.replaceableItems = replaceableItems;
            
            this.render();
        })();
    }

    static get defaultOptions() {
        return foundry.utils.mergeObject(super.defaultOptions, {
            template: "modules/wire/templates/apps/compendium-actor.hbs",
            classes: ["compendium-upgrade"],
            width: 700,
            height: 600,
            scrollY: ['.compendium-upgrade-container'],
            resizable: true
        });
    }

    get title() {
        return i18n("wire.compendium.actor-upgrade.title", { actorName: this.object.name })
    }

    get availablePacks() {
        return game.packs.contents
            .filter(p => p.metadata.type === "Item")
            .filter(p => p.metadata.flags.wireImport);
    }

    get availablePackOptions() {
        return this.availablePacks.reduce((a, p) => { a[p.metadata.id] = p.metadata.label; return a; }, {});
    }

    async getAvailablePackItems() {
        return Promise.all(this.availablePacks.map(async pack => {
            const documents = await pack.getDocuments();
            return { pack, documents };
        }));
    }

    getData(opts) {
        const actor = this.object;
        const availablePackOptions = this.availablePackOptions;
        const packItems = this.packItems;
        const upgradeableItems = this.upgradeableItems;
        const replaceableItems = this.replaceableItems;

        return {
            actor, availablePackOptions, packItems, upgradeableItems, replaceableItems
        };
    }

    activateListeners(html) {
        html.find('a[data-action="open-actor-item"]').click(async function (event) {
            const uuid = event.target.closest('.item-upgrade-row').dataset.actorItemUuid;
            const item = await fromUuid(uuid);
            item?.sheet.render(true);
        });
        html.find('a[data-action="open-pack-item"]').click(async function (event) {
            const uuid = event.target.closest('.item-upgrade-row').dataset.packItemUuid;
            const item = await fromUuid(uuid);
            item?.sheet.render(true);
        });

        html.find('.list-toggle').change(function(event) {
            const state = event.target.checked;
            const listName = event.target.dataset.list;
            html.find(`input[type="checkbox"][data-list="${listName}"]`).prop("checked", state)
        });
    }

    _updateObject(event, formData) {
        const imports = Array.isArray(formData.import) ? formData.import : [formData.import];
        const actorItemUuids = imports.filter(i => i);

        (async () => {
            const entryMatches = (r => actorItemUuids.includes(r.actorItem.uuid));
            const importedEntries = [...this.upgradeableItems.filter(entryMatches), ...this.replaceableItems.filter(entryMatches)];
    
            const toDelete = [];
            const toCreate = [];
    
            for (const entry of importedEntries) {
                const incoming = entry.packItem.toObject();
                const outgoing = entry.actorItem.toObject();
    
                const sort = outgoing.sort;
                const { preparation, uses } = outgoing.system;
    
                Object.assign(incoming.system, { preparation, uses });
                Object.assign(incoming, { sort });
    
                toDelete.push(entry.actorItem.id);
                toCreate.push(incoming);
            }
    
            await this.object.deleteEmbeddedDocuments("Item", toDelete);
            await this.object.createEmbeddedDocuments("Item", toCreate);
        })();
    }

}
