import { i18n } from "../utils.js";


export class PackItemCompendiumConfig extends FormApplication {
    
    constructor(item, options = {}) {
        super(item, options);
    }

    static get defaultOptions() {
        return foundry.utils.mergeObject(super.defaultOptions, {
            template: "modules/wire/templates/apps/compendium-pack-item.hbs",
            classes: ["wire-compendium", "wire-compendium__pack-item"],
            width: 300,
            submitOnChange: true,
            closeOnSubmit: false
        });
    }

    get title() {
        return i18n("wire.compendium.pack-item.title", { itemName: this.object.name })
    }

    get pack() {
        return game.packs.get(this.object.pack);
    }

    get module() {
        return game.modules.get(this.pack?.metadata.packageName);
    }

    getData(opts) {
        const item = this.object;
        const itemPack = item.pack;
        const pack = game.packs.get(itemPack);
        const moduleName = pack.metadata.packageName;
        const module = game.modules.get(moduleName);

        return {
            item, pack, module
        };
    }

    activateListeners(html) {
        html.find('a[action="use-module-version"]').click(async () => {
            await this.object.update({ "flags.wire.compendiumVersion": this.module?.version });
            this.render();
        });
    }

    _updateObject(event, formData) {
        this.object.update(formData);
    }
    
}
