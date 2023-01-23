import { DamageParts } from "../game/damage-parts.js";
import { i18n, makeModifier } from "../utils.js";

export class ConfigureDamage extends Dialog {
    constructor(activation, options, damageRows, situationalBonus) {
        super({}, options);

        this.activation = activation;
        this.damageRows = damageRows;
        this.situationalBonus = situationalBonus;

        this.data = {
            buttons: {
                normal: {
                    label: i18n("wire.configure-damage.roll"),
                    callback: html => this.resolve(this._onSubmitRoll(html, "normal"))
                }
            },
            default: "normal",
        }

        if (options.canCrit) {
            this.data.buttons.critical = {
                label: i18n("wire.configure-damage.critical"),
                callback: html => this.resolve(this._onSubmitRoll(html, "critical"))
            };
            this.data.default = options.isCrit ? "critical" : "normal";
        }
    }

    static get defaultOptions() {
        return foundry.utils.mergeObject(super.defaultOptions, {
            template: "modules/wire/templates/apps/configure-damage.hbs",
            classes: ["dialog", "configure-damage"],
            width: 300
        });
    }

    get title() {
        return i18n("wire.configure-damage.title", { name: this.activation.item.name });
    }
    
    getData(opts) {
        const { buttons } = super.getData(opts);

        const damageParts = this.damageRows.map(r => ({
            formula: r.formula.replace(RollTerm.FLAVOR_REGEXP, ""),
            type: r.type
        }));
        const damageLabels = { ...CONFIG.DND5E.damageTypes, ...CONFIG.DND5E.healingTypes };

        if (this.situationalBonus) {
            damageParts.push({ formula: makeModifier(this.situationalBonus), type: "situational" });
            damageLabels["situational"] = i18n("wire.roll-component.situational");
        }

        return {
            damageParts,
            damageLabels,
            buttons
        };
    }

    _onSubmitRoll(html, mode) {
        const form = html[0].querySelector("form");

        const damage = form.bonus.value.trim();
        this.resolve({
            damage,
            isCritical: mode == "critical"
        });
        this.close();
        return false;
    }

    render(force=false, options={}) {
        return new Promise(async (resolve, reject) => {
            // this.damageParts = await DamageParts.roll(this.activation, !!this.activation.attackResult, { evaluateCritical: false });
            this.resolve = resolve;
            super.render(force, options);
        });
    }

    async close(options) {
        this.resolve();
        return super.close(options);
    }

}