import { getAbilityCheckOptions } from "../game/effect-flags.js";
import { getDisplayableCheckComponents } from "../game/check-and-save-components.js";
import { i18n } from "../utils.js";

export class ConfigureCheck extends Dialog {
    constructor(actor, ability, activation, options) {
        super({}, options);

        this.actor = actor;
        this.ability = ability;
        this.activation = activation;

        const checkOptions = getAbilityCheckOptions(actor, ability, activation);
        const config = activation?.config || {};

        const advantage = !config.check?.disadvantage && (checkOptions.advantage || config.check?.advantage);
        const disadvantage = !config.check?.advantage && (checkOptions.disadvantage || config.check?.disadvantage);

        const defaultMode = advantage ? "advantage" : (disadvantage ? "disadvantage" : "normal");

        this.data = {
            buttons: {
                advantage: {
                    label: game.i18n.localize("DND5E.Advantage"),
                    callback: html => this.resolve(this._onSubmitRoll(html, "advantage"))
                },
                normal: {
                    label: game.i18n.localize("DND5E.Normal"),
                    callback: html => this.resolve(this._onSubmitRoll(html, "normal"))
                },
                disadvantage: {
                    label: game.i18n.localize("DND5E.Disadvantage"),
                    callback: html => this.resolve(this._onSubmitRoll(html, "disadvantage"))
                }
            },
            default: defaultMode,
            ...options
        }
    }

    static get defaultOptions() {
        return foundry.utils.mergeObject(super.defaultOptions, {
            template: "modules/wire/templates/apps/configure-check.hbs",
            classes: ["dialog", "configure-check", "configure-ability-check"],
            width: 300
        });
    }
    
    get title() {
        return this.options.title || i18n("wire.configure-check.check-title", { name: CONFIG.DND5E.abilities[this.ability] });
    }
    
    getData(opts) {
        const { buttons } = super.getData(opts);

        const components = [ ...getDisplayableCheckComponents(this.actor, this.ability) ];

        return {
            components,
            buttons
        };
    }

    _onSubmitRoll(html, mode) {
        const form = html[0].querySelector("form");

        const config = this.activation?.config || {};
        const bonusInput = form.bonus.value;

        const advantage = mode === "advantage";
        const disadvantage = mode === "disadvantage";
        const normal = mode === "normal";
        const bonus = [bonusInput, config.check?.bonus].filter(b => b).join(" + ");

        const check = { advantage, disadvantage, normal };
        if (bonus) { check.parts = [bonus]; }

        this.resolve(foundry.utils.mergeObject(config, check));
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
        this.resolve();
        return super.close(options);
    }
}
