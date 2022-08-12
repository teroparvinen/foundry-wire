import { localizedWarning } from "../utils.js";


export class DamageParts {
    static async roll(item, applicationType, onlyUnavoidable, { spellLevel, isCritical, attackTarget } = {}) {
        if (!item.hasDamage) throw new Error("You may not make a Damage Roll with this Item.");
        const itemData = item.data.data;
        const actorData = item.actor.data.data;
    
        // Get damage components
        let parts = this._itemDamageParts(item, applicationType, onlyUnavoidable);
        const primaryModifiers = [];

        if (!parts.length) {
            localizedWarning("wire.warn.damage-roll-has-no-parts");
            return new DamageParts([]);
        }
    
        // Get roll data
        const rollData = item.getRollData();
        if (spellLevel) rollData.item.level = spellLevel;

        // Add target info to roll data
        if (attackTarget) {
            const targetType = Object.keys(CONFIG.DND5E.creatureTypes).reduce((accumulator, value) => {
                return {...accumulator, [value]: 0 };
            }, {});
            targetType[attackTarget.data.data.details.type.value] = 1;
    
            const targetSize = Object.keys(CONFIG.DND5E.actorSizes).reduce((accumulator, value) => {
                return {...accumulator, [value]: 0 };
            }, {});
            targetSize[attackTarget.data.data.details.size] = 1;
    
            rollData.target = { type: targetType, size: targetSize };
        }
    
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
            const { isValid, terms } = simplifyDamageFormula(actorBonus.damage, rollData);
            const nonOperatorTerms = terms.filter(t => !(t instanceof OperatorTerm));
            const recognizedTerms = nonOperatorTerms.filter(t => CONFIG.DND5E.damageTypes[t.flavor]);
            if (isValid && recognizedTerms.length === nonOperatorTerms.length) {
                for (let t of recognizedTerms) {
                    parts.push({
                        formula: t.formula,
                        type: t.flavor,
                        halving: parts[0].halving,
                        applicationType: parts[0].applicationType
                    });
                }
            } else {
                localizedWarning("wire.warn.could-not-parse-bonus-damage");
            }

            // const terms = new Roll.parse(actorBonus.damage, rollData);
            // const recognizedTerms = terms.filter(t => {
            //     if (t instanceof ParentheticalTerm || t instanceof NumericTerm || t instanceof DiceTerm || (t instanceof OperatorTerm && t.operator === "+")) { return true; }
            // });
            // if (recognizedTerms.length === roll.terms.length) {
            //     for (let t of recognizedTerms) {
            //         if (!(t instanceof OperatorTerm)) {
            //             if (t.flavor && CONFIG.DND5E.damageTypes[t.flavor]) {
            //                 parts.push({
            //                     formula: t.formula,
            //                     type: t.flavor,
            //                     halving: parts[0].halving,
            //                     applicationType: parts[0].applicationType
            //                 });
            //             } else {
            //                 primaryModifiers.push(t.formula);
            //             }
            //         }
            //     }
            // } else {
            //     primaryModifiers.push(actorBonus.damage);
            // }
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

        let criticalThreshold = 20;
        if (item.data.type === "weapon") { criticalThreshold = item.actor.data.flags?.dnd5e?.weaponCriticalThreshold || criticalThreshold }
        if (item.data.type === "spell") { criticalThreshold = item.actor.data.flags?.dnd5e?.spellCriticalThreshold || criticalThreshold }

        // Apply flavor to dice
        partsWithRolls.forEach(pr => pr.roll.dice.forEach(die => {
            die.options.flavor = pr.part.type;
            die.options.critical = criticalThreshold
        }));
    
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

    static async singleValue(formula, damageType) {
        const part = {
            formula: String(formula),
            type: damageType,
            halving: "none",
            applicationType: "immediate"
        };
        const pr = {
            part: part,
            roll: new CONFIG.Dice.DamageRoll(part.formula, {}, {})
        };

        await pr.roll.evaluate({ async: true });
        pr.roll.dice.forEach(die => {
            die.options.flavor = pr.part.type;
        });

        return new DamageParts([pr]);
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

function splitByOperator(terms) {
    const groups = [];
    let current = [];

    if (!Array.isArray(terms)) { return terms; }
    for (let t of terms) {
        if (t instanceof OperatorTerm) {
            groups.push(current);
            groups.push(t);
            current = [];
        } else {
            if (t instanceof ParentheticalTerm) {
                const pterms = Roll.parse(t.term);
                const r = splitByOperator(pterms);
                if (r.every(r => r instanceof NumericTerm || r instanceof OperatorTerm)) {
                    current.push(new NumericTerm({ number: Roll.fromTerms(r, { flavor: t.flavor }).evaluate({ async: false }).total }));
                } else {
                    r.flavor = t.flavor;
                    current.push(r);
                }
            } else {
                current.push(t);
            }
        }
    }
    if (current.length) { groups.push(current); }

    if (groups.length == 1) {
        if (groups[0].length == 1) { return groups[0][0] }
        if (groups[0].length == 2 && groups[0][0] instanceof NumericTerm && groups[0][1] instanceof StringTerm) {
            return Roll.parse(`${groups[0][0].expression}${groups[0][1].term}`);
        }
        return groups[0];
    } else {
        return groups.map(g => {
            const r = splitByOperator(g);
            if (!Array.isArray(r)) { return r; }
            else if (r.length == 1) {
                return (r[0]);
            } else {
                return r;
            }
        });
    }
}
  
function simplifyDamageFormula(formula, rollData) {
    const incomingTerms = Roll.parse(formula, rollData);
    const groups = splitByOperator(incomingTerms);

    if (!Array.isArray(groups) && (groups instanceof NumericTerm || groups instanceof Die)) {
        return { isValid: true, terms: [groups] };
    }

    let failed = false;
    const terms = groups.reduce((list, i) => {
        if (!Array.isArray(i)) { list.push(i); }
        else if (i.every(r => r instanceof NumericTerm || r instanceof OperatorTerm || r instanceof Die)) {
            i.forEach(r => r.options.flavor = i.flavor);
            list.push(...i);
        } else {
            list.push(i);
            failed = true;
        }
        return list;
    }, []);

    const isValid = !failed;
    return { isValid, terms }
}