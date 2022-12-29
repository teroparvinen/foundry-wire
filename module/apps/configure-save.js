import { getSaveOptions } from "../game/effect-flags.js";
import { getDisplayableSaveComponents } from "../game/check-and-save-components.js";

export class ConfigureSave extends Application {
    constructor(actor, ability, activation, options) {
        super(options);

        this.actor = actor;
        this.ability = ability;
        this.activation = activation;
    }

    static get defaultOptions() {
        return foundry.utils.mergeObject(super.defaultOptions, {
            title: "wire.configure-check.save-title",
            template: "modules/wire/templates/apps/configure-check.hbs",
            classes: ["dialog", "configure-check", "configure-save"],
            width: 300
        });
    }
    
    getData(opts) {
        const components = [ ...getDisplayableSaveComponents(this.actor, this.ability) ];
        const modeOptions = {
            advantage: "wire.roll-component.advantage",
            normal: "wire.roll-component.normal",
            disadvantage: "wire.roll-component.disadvantage",
        };
        const options = getSaveOptions(this.actor, this.ability, this.activation);
        const config = this.activation?.config || {};

        const advantage = !config.save?.disadvantage && (options.advantage || config.save?.advantage);
        const disadvantage = !config.save?.advantage && (options.disadvantage || config.save?.disadvantage);

        const defaultMode = advantage ? "advantage" : (disadvantage ? "disadvantage" : "normal");

        return {
            components,
            modeOptions,
            defaultMode
        };
    }

    activateListeners(html) {
        html.find('.configure-check__custom-bonus').focus();
        html.submit(this._onSubmit.bind(this));
    }

    _onSubmit(event) {
        event.preventDefault();
        const config = this.activation?.config || {};
        const bonusInput = $(this.element).find('.configure-check__custom-bonus').val();
        const mode = $(this.element).find('.configure-check__mode-select').val();

        const advantage = mode === "advantage";
        const disadvantage = mode === "disadvantage";
        const normal = mode === "normal";
        const bonus = [bonusInput, config.save?.bonus].filter(b => b).join(" + ");

        const save = { advantage, disadvantage, normal, parts: [bonus] };

        this.resolve(foundry.utils.mergeObject(config, save));
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
