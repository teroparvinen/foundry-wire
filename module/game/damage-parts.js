

export class DamageParts {
    static async roll(item, applicationType, onlyUnavoidable, { spellLevel, isCritical } = {}) {
        if (!item.hasDamage) throw new Error("You may not make a Damage Roll with this Item.");
        const itemData = item.data.data;
        const actorData = item.actor.data.data;
    
        // Get damage components
        const parts = this._itemDamageParts(item, applicationType, onlyUnavoidable);
        const primaryModifiers = [];
    
        // Get roll data
        const rollData = item.getRollData();
        if (spellLevel) rollData.item.level = spellLevel;
    
        // Scale damage from up-casting spells
        if ((item.data.type === "spell")) {
            let scalingMultiplier = 0;
            if ((itemData.scaling.mode === "cantrip")) {
                let level;
                if ( item.actor.type === "character" ) level = actorData.details.level;
                else if ( itemData.preparation.mode === "innate" ) level = Math.ceil(actorData.details.cr);
                else level = actorData.details.spellLevel;

                scalingMultiplier = Math.floor((level + 1) / 6);
            } else if (spellLevel && (itemData.scaling.mode === "level") && itemData.scaling.formula) {
                scalingMultiplier = Math.max(spellLevel - itemData.level, 0);
            }
            if (scalingMultiplier > 0) {
                const s = new Roll(itemData.scaling.formula, rollData).alter(times);
                primaryModifiers.push(s.formula);
            }
        }
    
        // Add damage bonus formula
        const actorBonus = getProperty(actorData, `bonuses.${itemData.actionType}`) || {};
        if (actorBonus.damage && (parseInt(actorBonus.damage) !== 0)) {
            primaryModifiers.push(actorBonus.damage);
        }
    
        // Handle ammunition damage
        let ammoParts = [];
        const ammoData = item._ammo?.data;
        if (item._ammo && (ammoData.type === "consumable") && (ammoData.data.consumableType === "ammo")) {
            ammoParts = this._itemDamageParts(item._ammo, applicationType, onlyUnavoidable);
            delete item._ammo;
        }
    
        // Factor in extra critical damage dice from the Barbarian's "Brutal Critical"
        const criticalBonusDice = itemData.actionType === "mwak" ? item.actor.getFlag("dnd5e", "meleeCriticalDamageDice") ?? 0 : 0;
    
        // Factor in extra weapon-specific critical damage
        const criticalBonusDamage = itemData.critical?.damage;

        // Construct the DamageRoll instances for each part
        const partsWithRolls = [...parts, ...ammoParts].map((part, n) => {
            if (n === 0) {
                const formula = [part.formula, ...primaryModifiers].join(" + ");
                return {
                    part: part,
                    roll: new CONFIG.Dice.DamageRoll(formula, rollData, {
                        critical: isCritical,
                        criticalBonusDice,
                        criticalBonusDamage,
                        multiplyNumeric: game.settings.get("dnd5e", "criticalDamageModifiers"),
                        powerfulCritical: game.settings.get("dnd5e", "criticalDamageMaxDice")
                    })
                }
            } else {
                return {
                    part: part,
                    roll: new CONFIG.Dice.DamageRoll(part.formula, rollData, {
                        critical: isCritical,
                        multiplyNumeric: game.settings.get("dnd5e", "criticalDamageModifiers"),
                        powerfulCritical: game.settings.get("dnd5e", "criticalDamageMaxDice")
                    })
                };
            }
        });
    
        // Evaluate the configured roll
        await Promise.all(partsWithRolls.map(pr => pr.roll.evaluate({ async: true })));

        // Apply flavor to dice
        partsWithRolls.forEach(pr => pr.roll.dice.forEach(die => die.options.flavor = pr.part.type));
    
        return new DamageParts(partsWithRolls);
    }

    static _itemDamageParts(item, applicationType, onlyUnavoidable) {
        const itemData = item.data.data;
        return itemData.damage.parts
            .map(d => {
                return {
                    formula: d[0],
                    type: d[1],
                    halving: d[2] || "none",
                    applicationType: d[3] || "immediate"
                }
            })
            .filter(d => d.applicationType === applicationType && (!onlyUnavoidable || d.halving !== "none"));
    }

    static fromData(data) {
        return new DamageParts(data.map(pr => {
            return {
                part: pr.part,
                roll: CONFIG.Dice.DamageRoll.fromData(pr.roll)
            }
        }));
    }

    constructor(partsWithRolls) {
        this.result = partsWithRolls;
    }

    get total() {
        return this.result.pr.reduce((prev, part) => prev + part.roll.total, 0);
    }

    appliedToActor(actor, isEffective) {
        function halvingFactor(halving, isEffective) {
            if (!isEffective) {
                if (halving == "full") return 1;
                if (halving == "half") return 0.5;
                return 0;
            }
            return 1;
        }

        const components = this.result.map(pr => {
            const type = pr.part.type;
            const halving = pr.part.halving;
            const points = pr.roll.total;

            const caused = Math.floor(halvingFactor(halving, isEffective) * points);

            if (type === "healing") { return { healing: caused } };
            if (type === "temphp") { return { temphp: caused } };
            
            const traits = actor.data.data.traits;
            const di = traits.di.value.includes(type) ? 0 : 1;
            const dr = traits.dr.value.includes(type) ? 0.5 : 1;
            const dv = traits.dv.value.includes(type) ? 2 : 1;

            return {
                damage: Math.floor(caused * di * dr * dv),
                di: (1 - di) * caused,
                dr: caused - Math.floor(dr * caused),
                dv: caused * dv - caused
            };
        });
        return components.reduce((prev, c) => {
            return {
                damage: prev.damage + c.damage || 0,
                healing: prev.healing + c.healing || 0,
                temphp: prev.temphp + c.temphp || 0,
                di: prev.di + c.di || 0,
                dr: prev.dr + c.dr || 0,
                dv: prev.dv + c.dv || 0,
            }
        }, { damage: 0, healing: 0, temphp: 0, di: 0, dr: 0, dv: 0 });
    }

    async roll3dDice() {
        if (game.dice3d) {
            await Promise.all(this.result.map(dp => game.dice3d.showForRoll(dp.roll, game.user, !game.user.isGM)));
        }
    }

    async combinedRoll() {
        const partsWithRolls = this.result;

        let terms = partsWithRolls.map(pr => new NumericTerm({ number: pr.roll.total, options: { flavor: pr.part.type } }));
        const dice = partsWithRolls.flatMap(pr => pr.roll.dice);
    
        for (let i = terms.length - 2; i >= 0; i--) {
            terms.splice(i+1, 0, new OperatorTerm({ operator: "+" }));
        }
    
        const roll = Roll.fromTerms(terms);
        await roll.evaluate({ async: true });
        roll._dice = dice;
    
        return roll;
    }

    toJSON() {
        return this.result.map(pr => {
            return {
                part: pr.part,
                roll: pr.roll.toJSON()
            };
        });
    }
}