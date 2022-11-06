import { getDisplayableAttackComponents } from "../game/attack-components.js";
import { getStaticAttackOptions } from "../game/effect-flags.js";
import { makeModifier } from "../utils.js";

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
        const situationalComponents = this.config.attack?.bonus ? [{
            i18nKey: "wire.roll-component.situational",
            value: makeModifier(this.config.attack.bonus)
        }] : [];

        const item = this.item;
        const components = [ ...getDisplayableAttackComponents(item), ...situationalComponents ];
        const modeOptions = {
            advantage: "wire.roll-component.advantage",
            normal: "wire.roll-component.normal",
            disadvantage: "wire.roll-component.disadvantage",
        };
        const target = game.user.targets.first()?.actor;
        const options = getStaticAttackOptions(item, target, this.config.attack);

        const advantage = !this.config.attack?.disadvantage && (options.advantage || this.config.attack?.advantage);
        const disadvantage = !this.config.attack?.advantage && (options.disadvantage || this.config.attack?.disadvantage);

        const defaultMode = advantage ? "advantage" : (disadvantage ? "disadvantage" : "normal");

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
        const bonusInput = $(this.element).find('.configure-attack__custom-bonus').val();
        const mode = $(this.element).find('.configure-attack__mode-select').val();

        const advantage = mode === "advantage";
        const disadvantage = mode === "disadvantage";
        const bonus = [bonusInput, this.config.attack?.bonus].filter(b => b).join(" + ");

        const attack = { advantage, disadvantage, bonus };

        this.resolve(foundry.utils.mergeObject(this.config, { attack }));
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
