import { getAvailablePackImports, getAvailablePacks, importPackItems } from "../compendiums.js";
import { i18n } from "../utils.js";

export class ActorCompendiumUpgrade extends FormApplication {

    constructor(actor, options = {}) {
        super(actor, options);

        this.object = actor;

        (async () => {
            const { upgradeableItems, replaceableItems } = await getAvailablePackImports(actor);

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
        return getAvailablePacks();
    }

    get availablePackOptions() {
        return this.availablePacks.reduce((a, p) => { a[p.metadata.id] = p.metadata.label; return a; }, {});
    }

    getData(opts) {
        const actor = this.object;
        const availablePackOptions = this.availablePackOptions;
        const upgradeableItems = this.upgradeableItems;
        const replaceableItems = this.replaceableItems;

        return {
            actor, availablePackOptions, upgradeableItems, replaceableItems
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

            await importPackItems(this.object, importedEntries);
        })();
    }

}
