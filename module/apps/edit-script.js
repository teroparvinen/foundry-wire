import { i18n } from "../utils.js";


export class EditScript extends MacroConfig {
    static get defaultOptions() {
        return mergeObject(super.defaultOptions, {
            template: "modules/wire/templates/apps/edit-script.hbs",
            classes: ["macro-sheet", "sheet", "edit-script"],
            closeOnSubmit: false
        });
    }

    constructor(item) {
        const macro = new Macro({ name : item.name, scope : "global", type : "script", command: item.flags.wire?.script });
        super(macro);

        this.macro = macro;
        this.item = item;
    }

    get id() {
        return `wire-script-${this.item.uuid}`;
    }

    get title() {
        return i18n("wire.edit-script.title", { name: this.item.name });
    }

    getData(options={}) {
        const data = super.getData();
        data.item = this.item;
        return data;
    }

    activateListeners(html) {
        html.find("button.save").click(async event => {
            await this._onSubmit(event);
        });
        html.find("button.save-and-close").click(async event => {
            await this._onSubmit(event);
            this.close();
        });
        html.find("button.activate").click(async event => {
            await this._onSubmit(event);
            this.item.use({}, event);
        });
    }

    async _updateObject(event, formData) {
        await this.item.setFlag("wire", "script", formData.command);
    }
}