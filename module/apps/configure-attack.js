import { getDisplayableAttackComponents } from "../game/attack-components.js";
import { getStaticAttackOptions } from "../game/effect-flags.js";
import { i18n, makeModifier } from "../utils.js";

export class ConfigureAttack extends Dialog {
    constructor(item, config, options) {
        super({}, options);

        this.item = item;
        this.config = config;

        const target = game.user.targets.first()?.actor;
        const attackOptions = getStaticAttackOptions(item, target, config);
        const advantage = !config.attack?.disadvantage && (attackOptions.advantage || config.attack?.advantage);
        const disadvantage = !config.attack?.advantage && (attackOptions.disadvantage || config.attack?.disadvantage);

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
        }
    }

    static get defaultOptions() {
        return foundry.utils.mergeObject(super.defaultOptions, {
            template: "modules/wire/templates/apps/configure-check.hbs",
            classes: ["dialog", "configure-check", "configure-attack"],
            width: 350
        });
    }

    get title() {
        return i18n("wire.configure-check.attack-title", { name: this.item.name });
    }
    
    getData(opts) {
        const { buttons } = super.getData(opts);

        const situationalComponents = this.config.attack?.bonus ? [{
            i18nKey: "wire.roll-component.situational",
            value: makeModifier(this.config.attack.bonus)
        }] : [];

        const item = this.item;
        const components = [ ...getDisplayableAttackComponents(item), ...situationalComponents ];

        const showHint = true;

        return {
            components,
            showHint,
            buttons
        };
    }

    _onSubmitRoll(html, mode) {
        const form = html[0].querySelector("form");

        const bonusInput = form.bonus.value;

        const advantage = mode === "advantage";
        const disadvantage = mode === "disadvantage";
        const normal = mode === "normal";
        const bonus = [bonusInput, this.config.attack?.bonus].filter(b => b).join(" + ");

        const attack = { advantage, disadvantage, normal, bonus };

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
