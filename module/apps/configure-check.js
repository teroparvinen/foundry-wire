import { getAbilityCheckOptions } from "../game/effect-flags.js";
import { getDisplayableCheckComponents } from "../game/check-and-save-components.js";

export class ConfigureCheck extends Application {
    constructor(actor, ability, config, options) {
        super(options);

        this.actor = actor;
        this.ability = ability;
        this.config = config;
    }

    static get defaultOptions() {
        return foundry.utils.mergeObject(super.defaultOptions, {
            title: "wire.configure-check.check-title",
            template: "modules/wire/templates/apps/configure-check.hbs",
            classes: ["dialog", "configure-check", "configure-ability-check"],
            width: 300
        });
    }
    
    getData(opts) {
        const components = [ ...getDisplayableCheckComponents(this.actor, this.ability) ];
        const modeOptions = {
            advantage: "wire.roll-component.advantage",
            normal: "wire.roll-component.normal",
            disadvantage: "wire.roll-component.disadvantage",
        };
        const options = getAbilityCheckOptions(this.actor, this.ability);

        const advantage = !this.config.check?.disadvantage && (options.advantage || this.config.check?.advantage);
        const disadvantage = !this.config.check?.advantage && (options.disadvantage || this.config.check?.disadvantage);

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
        const bonusInput = $(this.element).find('.configure-check__custom-bonus').val();
        const mode = $(this.element).find('.configure-check__mode-select').val();

        const advantage = mode === "advantage";
        const disadvantage = mode === "disadvantage";
        const normal = mode === "normal";
        const bonus = [bonusInput, this.config.check?.bonus].filter(b => b).join(" + ");

        const check = { advantage, disadvantage, normal, parts: [bonus] };

        this.resolve(foundry.utils.mergeObject(this.config, check));
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
