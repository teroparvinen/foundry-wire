
export class SelectVariantDialog extends Application {
    constructor(item, variants, options) {
        super(options);

        this.item = item;
        this.variants = variants;
    }

    static get defaultOptions() {
        return foundry.utils.mergeObject(super.defaultOptions, {
            template: "modules/wire/templates/apps/select-variant.hbs",
            classes: ["dialog", "select-variant"]
        });
    }

    get title() {
        return this.item.name;
    }

    getData(options) {
        const variants = this.variants;
        return {
            variants
        };
    }

    activateListeners(html) {
        html.find(".dialog-button").click(this._onClickButton.bind(this));
    }

    _onClickButton(event) {
        const variant = event.currentTarget.dataset.button;
        this.resolve(variant);
        this.close();
    }

    render(force=false, options={}) {
        return new Promise((resolve, reject) => {
            this.resolve = resolve;
            super.render(force, options);
        });
    }

    async close(options) {
        this.resolve();
        return super.close(options);
    }
}
