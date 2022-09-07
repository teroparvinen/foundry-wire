import { DamageParts } from "../game/damage-parts.js";

export class ConfigureDamage extends Application {
    constructor(activation, options) {
        super(options);

        this.activation = activation;
    }

    static get defaultOptions() {
        return foundry.utils.mergeObject(super.defaultOptions, {
            title: "wire.configure-damage.title",
            template: "modules/wire/templates/apps/configure-damage.hbs",
            classes: ["dialog", "configure-damage"],
            width: 300
        });
    }

    getData(options) {
        const damageParts = this.damageParts.result.map(r => {
            const formula = r.roll.formula.replace(RollTerm.FLAVOR_REGEXP, "");
            const type = r.part.type;
            return { formula, type };
        });
        const damageLabels = { ...CONFIG.DND5E.damageTypes, ...CONFIG.DND5E.healingTypes };

        return {
            damageParts,
            damageLabels
        };
    }

    activateListeners(html) {
        html.find('.configure-damage__custom-damage').focus();

        html.submit(this._onSubmit.bind(this));
    }

    _onSubmit(event) {
        event.preventDefault();
        const value = $(this.element).find('.configure-damage__custom-damage').val();
        this.resolve(value);
        this.close();
        return false;
    }

    render(force=false, options={}) {
        return new Promise(async (resolve, reject) => {
            this.damageParts = await DamageParts.roll(this.activation, !!this.activation.attackResult);
            this.resolve = resolve;
            super.render(force, options);
        });
    }

    async close(options) {
        this.resolve();
        return super.close(options);
    }

}