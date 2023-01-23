
export class ConfigureCheck extends Dialog {
    constructor(config, options) {
        super({}, options);

        this.config = config;

        const defaultMode = config.advantage ? "advantage" : (config.disadvantage ? "disadvantage" : "normal");

        this.data = {
            buttons: {
                advantage: {
                    label: game.i18n.localize("DND5E.Advantage"),
                    callback: html => this.resolve(this._onSubmitRoll(html, CONFIG.Dice.D20Roll.ADV_MODE.ADVANTAGE))
                },
                normal: {
                    label: game.i18n.localize("DND5E.Normal"),
                    callback: html => this.resolve(this._onSubmitRoll(html, CONFIG.Dice.D20Roll.ADV_MODE.NORMAL))
                },
                disadvantage: {
                    label: game.i18n.localize("DND5E.Disadvantage"),
                    callback: html => this.resolve(this._onSubmitRoll(html, CONFIG.Dice.D20Roll.ADV_MODE.DISADVANTAGE))
                }
            },
            default: defaultMode,
        }
    }

    static get defaultOptions() {
        return foundry.utils.mergeObject(super.defaultOptions, {
            template: "modules/wire/templates/apps/configure-check.hbs",
            classes: ["dialog", "configure-check", "configure-ability-check"],
            width: 350
        });
    }
    
    get title() {
        return this.options.title || this.config.title;
    }
    
    getData(opts) {
        const { buttons } = super.getData(opts);

        const components = this.options.wire.components || [];

        return {
            components,
            buttons
        };
    }

    _onSubmitRoll(html, mode) {
        const form = html[0].querySelector("form");

        const bonus = form.bonus.value;

        const attack = { mode, bonus };

        this.resolve(attack);
        this.close();
        return false;
    }

    render(force=false, options={}) {
        return new Promise(async (resolve, reject) => {
            // Async prep here
            this.resolve = resolve;
            super.render(force, options);
        });
    }

    async close(options) {
        this.resolve(null);
        return super.close(options);
    }
}
