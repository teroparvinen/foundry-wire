import { getDisplayableAttackComponents } from "../game/attack-components.js";
import { getAttackOptions } from "../game/effect-flags.js";

export class ConfigureAttack extends Application {
    constructor(item, config, options) {
        super(options);

        this.item = item;
        this.config = config;
    }

    static get defaultOptions() {
        return foundry.utils.mergeObject(super.defaultOptions, {
            title: "wire.configure-attack.title",
            template: "modules/wire/templates/apps/configure-attack.hbs",
            classes: ["dialog", "configure-attack"],
            width: 300
        });
    }

    getData(opts) {
        const item = this.item;
        const components = getDisplayableAttackComponents(item);
        const modeOptions = {
            advantage: "wire.roll-component.advantage",
            normal: "wire.roll-component.normal",
            disadvantage: "wire.roll-component.disadvantage",
        };
        const target = game.user.targets.first()?.actor;
        const options = getAttackOptions(item, target, this.config);
        const defaultMode = options.advantage ? "advantage" : (options.disadvantage ? "disadvantage" : "normal");

        return {
            item,
            components,
            modeOptions,
            defaultMode
        };
    }

    activateListeners(html) {
        html.find('.configure-attack__custom-bonus').focus();
        html.submit(this._onSubmit.bind(this));
    }

    _onSubmit(event) {
        event.preventDefault();
        const bonus = $(this.element).find('.configure-attack__custom-bonus').val();
        const mode = $(this.element).find('.configure-attack__mode-select').val();
        const advantage = mode === "advantage";
        const disadvantage = mode === "disadvantage";
        this.resolve({ advantage, disadvantage, bonus });
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
