import { isAttackMagical } from "../item-properties.js";
import { compositeDamageParts, getAttackRollResultType, localizedWarning, stringMatchesVariant, typeCheckedNumber } from "../utils.js";
import { getDamageInflictingMultiplier, getDamageInflictingOptions, getDamageReceivingOptions, getDamageReduction, getEffectFlags } from "./effect-flags.js";


export class DamageParts {
    static isCritical(activation) {
        const item = activation.item;
        const attackTarget = activation.singleTarget?.actor;

        let isCritical = getAttackRollResultType(activation.attackRoll) == "critical";
    
        // Flags
        const actionType = item.system.actionType;

        if (attackTarget) {
            const grantFlags = getEffectFlags(attackTarget)?.grants?.critical || {};
            if (grantFlags.all || grantFlags[actionType]) {
                isCritical = true;
            }
        }

        const criticalFlags = getEffectFlags(item.actor)?.critical || {};
        if (criticalFlags.all || criticalFlags[actionType]) {
            isCritical = true;
        }

        return isCritical;
    }

    static async roll(activation, isAttack, { evaluateCritical = true } = {}) {
        const item = activation.item;
        const applicationType = activation.applicationType;
        const spellLevel = activation.config?.spellLevel;
        const variant = activation.config?.variant;
        const onlyUnavoidable = activation.effectiveTargets.length == 0;
        const additionalDamage = activation.config.damageBonus;
        const isOffhand = activation.config.damageOffhand;
        const isVersatile = activation.config.damageVersatile;

        let isCritical = (isAttack && evaluateCritical) ? DamageParts.isCritical(activation) : undefined;
        const singleTarget = activation.singleTarget?.actor;

        if (!item.hasDamage) throw new Error("You may not make a Damage Roll with this Item.");
        const itemData = item.system;
        const actorData = item.actor.system;

        // Get damage components
        let parts = this._itemDamageParts(item, applicationType, onlyUnavoidable, variant);
        const primaryModifiers = [];

        if (!parts.length) {
            localizedWarning("wire.warn.damage-roll-has-no-parts");
            return new DamageParts([]);
        }

        // Check offhand
        if (isOffhand && !item.actor.flags.wire?.twoWeaponFighting) {
            primaryModifiers.push("-@mod");
        }

        // Check versatile
        if (itemData.damage?.versatile && (isVersatile || item.actor.flags.wire?.damage?.versatile)) {
            parts[0].formula = itemData.damage.versatile;
        }
    
        // Get roll data
        const rollData = item.getRollData();
        if (spellLevel) rollData.item.level = spellLevel;
        rollData.config = activation.config;

        // Add target info to roll data
        if (singleTarget) {
            const targetType = Object.keys(CONFIG.DND5E.creatureTypes).reduce((accumulator, value) => {
                return {...accumulator, [value]: 0 };
            }, {});
            if (singleTarget.system.details?.type?.value) {
                targetType[singleTarget.system.details.type.value] = 1;
            }
    
            const targetSize = Object.keys(CONFIG.DND5E.actorSizes).reduce((accumulator, value) => {
                return {...accumulator, [value]: 0 };
            }, {});
            if (singleTarget.system.details?.size) {
                targetSize[singleTarget.system.details?.size] = 1;
            }
    
            rollData.target = foundry.utils.mergeObject({ type: targetType, size: targetSize }, singleTarget.getRollData());
        }
    
        // Scale damage from up-casting spells
        if (item.type === "spell") {
            let levelMultiplier = 0;
            let scalingFormula = itemData.scaling.formula;
            if ((itemData.scaling.mode === "cantrip")) {
                let level;
                if ( item.actor.type === "character" ) level = actorData.details.level;
                else if ( itemData.preparation.mode === "innate" ) level = Math.ceil(actorData.details.cr);
                else level = actorData.details.spellLevel;

                levelMultiplier = Math.floor((level + 1) / 6);
                scalingFormula = scalingFormula || parts[0].formula;
            } else if (spellLevel && (itemData.scaling.mode === "level") && itemData.scaling.formula) {
                levelMultiplier = Math.max(spellLevel - itemData.level, 0);
            }
            if (levelMultiplier > 0) {
                const upcastInterval = item.flags.wire?.upcastInterval || 1;
                const scalingMultiplier = upcastInterval ? Math.floor(levelMultiplier / upcastInterval) : levelMultiplier;
                const s = new Roll(scalingFormula, rollData).alter(scalingMultiplier, 0, { multiplyNumeric: true });
                if (s.formula) {
                    primaryModifiers.push(s.formula);
                }
            }
        }

        function handleDamageString(damageString) {
            if (damageString && (parseInt(damageString) !== 0)) {
                const { isValid, terms } = simplifyDamageFormula(damageString, rollData);

                let termsWithMults = [];
                let mult = 1;
                for (let term of terms) {
                    if (term instanceof OperatorTerm) {
                        mult = term.operator == "-" ? -1 : +1;
                    } else {
                        termsWithMults.push({ term, mult });
                    }
                }
                const nonOperatorTermsWithMults = termsWithMults.filter(tm => !(tm.term instanceof OperatorTerm));
                const damageTypes = [...Object.keys(CONFIG.DND5E.damageTypes), "healing", "temphp"];
                const allTypesValid = nonOperatorTermsWithMults.every(tm => !tm.term.flavor || damageTypes.includes(tm.term.flavor));
                if (isValid && allTypesValid) {
                    const recognizedTermsWithMults = nonOperatorTermsWithMults.filter(tm => !tm.term.flavor || damageTypes.includes(tm.term.flavor));
                    for (let tm of recognizedTermsWithMults) {
                        parts.push({
                            formula: tm.term.formula,
                            type: tm.term.flavor || parts[0].type,
                            halving: parts[0].halving,
                            applicationType: parts[0].applicationType,
                            multiplier: tm.mult
                        });
                    }
                } else {
                    localizedWarning("wire.warn.could-not-parse-bonus-damage");
                }
            }
        }
    
        // Add damage bonus formula
        const actorBonus = getProperty(actorData, `bonuses.${itemData.actionType}`) || {};
        handleDamageString(actorBonus.damage);

        // Add additional custom damage
        if (additionalDamage) {
            handleDamageString(additionalDamage);
        }
    
        // Handle ammunition damage
        let ammoParts = [];
        const ammoItem = item._ammo;
        if (ammoItem && (ammoItem.type === "consumable") && (ammoItem.system.consumableType === "ammo")) {
            ammoParts = this._itemDamageParts(ammoItem, applicationType, onlyUnavoidable);
            delete item._ammo;
        }

        // Effect damage multiplier
        parts = parts.map( part => ({ ...part, multiplier: getDamageInflictingMultiplier(item, item.actor, singleTarget, part.type) }));
    
        // Factor in extra critical damage dice from the Barbarian's "Brutal Critical"
        const criticalBonusDice = itemData.actionType === "mwak" ? item.actor.getFlag("dnd5e", "meleeCriticalDamageDice") ?? 0 : 0;
    
        // Factor in extra weapon-specific critical damage
        const criticalBonusDamage = itemData.critical?.damage;

        // Construct the DamageRoll instances for each part
        const partsWithRolls = [...parts, ...ammoParts].filter(p => p.formula).map((part, n) => {
            if (n === 0) {
                const formula = [part.formula, ...primaryModifiers].join(" + ");
                return {
                    part: { ...part, formula },
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
        for (let pr of partsWithRolls) {
            const { maximize, minimize } = getDamageInflictingOptions(item, singleTarget, pr.part.type, activation.config)
            await pr.roll.evaluate({ maximize, minimize, async: true });
        }

        let criticalThreshold = 20;
        if (item.type === "weapon") { criticalThreshold = item.actor.flags?.dnd5e?.weaponCriticalThreshold || criticalThreshold }
        if (item.type === "spell") { criticalThreshold = item.actor.flags?.dnd5e?.spellCriticalThreshold || criticalThreshold }

        // Apply flavor to dice
        partsWithRolls.forEach(pr => pr.roll.dice.forEach(die => {
            die.options.flavor = pr.part.type;
            die.options.critical = criticalThreshold;
        }));
    
        return new DamageParts(partsWithRolls);
    }

    static _itemDamageParts(item, applicationType, onlyUnavoidable, variant) {
        const parts = compositeDamageParts(item);
        return parts
            .map(d => {
                let variant;
                const formula = d[0].replace(RollTerm.FLAVOR_REGEXP, flavor => {
                    variant = flavor;
                    return "";
                });
              
                return {
                    formula,
                    type: d[1],
                    halving: d.halving || "none",
                    applicationType: d.application || "immediate",
                    multiplier: 1,
                    variant
                }
            })
            .filter(d => d.applicationType === applicationType && (!onlyUnavoidable || d.halving !== "none"))
            .filter(d => !variant || stringMatchesVariant(d.variant, variant));
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
        return this.result.reduce((prev, part) => prev + part.roll.total, 0);
    }

    async appliedToActor(item, actor, isEffective, activation) {
        function halvingFactor(halving, isEffective) {
            if (!isEffective) {
                if (halving == "full") return 1;
                if (halving == "half") return 0.5;
                return 0;
            }
            return 1;
        }

        const traits = actor.system.traits;
        const isMagical = isAttackMagical(item);
        const nmi = traits.di.value.includes("physical") && !isMagical;
        const nmr = traits.dr.value.includes("physical") && !isMagical;
        const nmv = traits.dv.value.includes("physical") && !isMagical;

        let damageReduction = getDamageReduction(actor);
        let reductionApplied = 0;
        let damageByType = {};

        function applyDamageReduction(type, incoming) {
            const current = damageReduction[type] || 0;
            const used = Math.min(current, incoming);
            reductionApplied += used;
            const remaining = current - used;
            damageReduction[type] = current - used;
            return incoming - used;
        }

        await Promise.all(this.result.map(async pr => {
            const { maximize, minimize, multiplier } = getDamageReceivingOptions(item, actor, pr.part.type, activation?.config);

            let roll = pr.roll;
            if (maximize) { roll = await pr.roll.reroll({ maximize, async: true }); }
            if (minimize) { roll = await pr.roll.reroll({ minimize, async: true }); }

            const mult = typeCheckedNumber(pr.part.multiplier, 1);
            const type = pr.part.type;
            const halving = pr.part.halving;

            const reduced = applyDamageReduction("all", applyDamageReduction(pr.part.type, applyDamageReduction(item.system.actionType, isMagical ? roll.total : applyDamageReduction("physical", roll.total))));
            const points = Math.floor(reduced * mult * multiplier);
            const caused = Math.floor(halvingFactor(halving, isEffective) * points);

            damageByType[type] = Math.max((damageByType[type] || 0) + caused, 0);
        }));

        const components = Object.entries(damageByType).map(([type, caused]) => {
            if (type === "healing") { return { healing: caused } };
            if (type === "temphp") { return { temphp: caused } };

            const di = traits.di.all || traits.di.value.includes(type) || nmi ? 0 : 1;
            const dr = traits.dr.all || traits.dr.value.includes(type) || nmr ? 0.5 : 1;
            const dv = traits.dv.all || traits.dv.value.includes(type) || nmv ? 2 : 1;

            return {
                damage: Math.floor(caused * di * dr * dv),
                di: (1 - di) * caused,
                dr: caused - Math.floor(dr * caused),
                dv: caused * dv - caused
            };
        });

        return components.reduce((prev, c) => {
            return {
                damage: prev.damage + (c.damage || 0),
                healing: prev.healing + (c.healing || 0),
                temphp: prev.temphp + (c.temphp || 0),
                di: prev.di + c.di || 0,
                dr: prev.dr + c.dr || 0,
                dv: prev.dv + c.dv || 0,
                damagereduction: prev.damagereduction
            }
        }, { damage: 0, healing: 0, temphp: 0, di: 0, dr: 0, dv: 0, damagereduction: reductionApplied });
    }

    async roll3dDice() {
        if (game.dice3d) {
            await Promise.all(this.result.map(dp => game.dice3d.showForRoll(dp.roll, game.user, !game.user.isGM)));
        }
    }

    async combinedRoll() {
        const partsWithRolls = this.result;

        let terms = partsWithRolls.map(pr => new NumericTerm({ number: Math.floor((pr.part.multiplier || 1) * pr.roll.total), options: { flavor: pr.part.type } }));
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


// Here be dragons
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
                if (Array.isArray(r) && r.every(r => r instanceof NumericTerm || r instanceof OperatorTerm)) {
                    current.push(new NumericTerm({ number: Roll.fromTerms(r, { flavor: t.flavor }).evaluate({ async: false }).total }));
                } else if (Array.isArray(r) && r.length == 1 && r[0] instanceof Die) {
                    const die = r[0];
                    die.options.flavor = t.flavor;
                    current.push(die);
                } else {
                    r.options.flavor = t.flavor;
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