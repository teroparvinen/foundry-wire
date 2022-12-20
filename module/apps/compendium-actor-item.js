import { i18n } from "../utils.js";


export class ActorItemCompendiumConfig extends FormApplication {

    constructor(item, options = {}) {
        super(item, options);
    }

    static get defaultOptions() {
        return foundry.utils.mergeObject(super.defaultOptions, {
            template: "modules/wire/templates/apps/compendium-actor-item.hbs",
            classes: ["wire-compendium", "wire-compendium__actor-item"],
            width: 400,
            submitOnChange: true,
            closeOnSubmit: false
        });
    }

    get title() {
        return i18n("wire.compendium.actor-item.title", { itemName: this.object.name })
    }

    get availablePacks() {
        return game.packs.contents
            .filter(p => game.user.isGM || !p.private)
            .filter(p => p.metadata.flags.wireImport)
            .reduce((a, p) => { a[p.metadata.id] = p.metadata.label; return a; }, {});
    }

    get sourcePack() {
        return game.packs.get(this.object.flags.wire?.compendiumSource);
    }

    get sourceModule() {
        return game.modules.get(this.sourcePack?.metadata.packageName);
    }

    getData(opts) {
        const item = this.object;
        const sourceModule = this.sourceModule;
        const availablePacks = this.availablePacks;

        return {
            item, sourceModule, availablePacks
        };
    }

    _updateObject(event, formData) {
        (async () => {
            const source = formData["flags.wire.compendiumSource"];
            const version = formData["flags.wire.compendiumVersion"]

            if (!source) {
                await this.object.unsetFlag("wire", "compendiumSource");
            } else {
                await this.object.setFlag("wire", "compendiumSource", source);
            }
            if (!version) {
                await this.object.unsetFlag("wire", "compendiumVersion");
            } else {
                await this.object.setFlag("wire", "compendiumVersion", version);
            }

            this.render();
        })();
    }
    
}
