import { hasConcentration, hasDamageOfType, hasDuration, hasEffectsOfType, hasSaveableApplicationsOfType, isAttack, isSave, isTokenTargetable } from "./item-properties.js";

export class Flow {
    static evaluate(item, applicationType, fn) {
        const flow = new Flow(item, applicationType);
        return flow.evaluate(fn);
    }

    constructor(item, applicationType) {
        this.item = item;
        this.applicationType = applicationType;
    }

    evaluate(fn) {
        const result = fn.apply(this).flat(100).filter(i => i);
        return result;
    }

    chain(input) {
        if (Array.isArray(input)) {
            return input;
        } else if (input) {
            return [input]
        }
        return [];
    }

    // Flow control

    pick() {
        for (let branch of arguments) {
            if (branch) {
                return branch;
            }
        }
    }

    otherwise() {
        return this.pick(...arguments);
    }

    sequence() {
        return [...arguments].filter(a => a);
    }

    // Item information

    hasAreaTarget() {
        if (this.item.hasAreaTarget) {
            return this.pick(...arguments);
        }
    }

    hasConcentration() {
        if (hasConcentration(this.item)) {
            return this.pick(...arguments);
        }
    }

    hasDamage() {
        if (hasDamageOfType(this.item, this.applicationType)) {
            return this.pick(...arguments);
        }
    }

    hasDamageOrEffects() {
        if (hasDamageOfType(this.item, this.applicationType) || hasEffectsOfType(this.item, this.applicationType)) {
            return this.pick(...arguments);
        }
    }

    hasDuration() {
        if (hasDuration(this.item)) {
            return this.pick(...arguments);
        }
    }

    hasSave() {
        if (this.item.hasSave) {
            return this.pick(...arguments);
        }
    }

    hasSaveableApplications() {
        if (this.item.hasSave && hasSaveableApplicationsOfType(this.item, this.applicationType)) {
            return this.pick(...arguments);
        }
    }

    isAttack() {
        if (isAttack(this.item)) {
            return this.pick(...arguments);
        }
    }

    isSave() {
        if (isSave(this.item)) {
            return this.pick(...arguments);
        }
    }

    isTokenTargetable() {
        if (isTokenTargetable(this.item)) {
            return this.pick(...arguments);
        }
    }

    // Operations

    applyConcentration() {
        return ["applyConcentration", ...this.chain(this.pick(...arguments))];
    }

    applyDamage() {
        return ["applyDamage", ...this.chain(this.pick(...arguments))];
    }

    applyDefaultTargets() {
        return ["applyDefaultTargets", ...this.chain(this.pick(...arguments))];
    }

    applyDurationEffect() {
        return ["applyDurationEffect", ...this.chain(this.pick(...arguments))];
    }

    applyEffects() {
        return ["applyEffects", ...this.chain(this.pick(...arguments))];
    }

    applySelectedTargets() {
        return ["applySelectedTargets", ...this.chain(this.pick(...arguments))];
    }

    confirmTargets() {
        return ["confirmTargets", ...this.chain(this.pick(...arguments))];
    }

    endEffect() {
        return ["endEffect", ...this.chain(this.pick(...arguments))];
    }

    endEffectOnSave() {
        return ["endEffectOnSave", ...this.chain(this.pick(...arguments))];
    }

    performAttackRoll() {
        return ["performAttackRoll", ...this.chain(this.pick(...arguments))];
    }

    performAttackDamageRoll() {
        if (hasDamageOfType(this.item, this.applicationType)) {
            return ["performAttackDamageRoll", ...this.chain(this.pick(...arguments))];
        }
    }

    performSaveDamageRoll() {
        if (hasDamageOfType(this.item, this.applicationType)) {
            return ["performSaveDamageRoll", ...this.chain(this.pick(...arguments))];
        }
    }

    performSavingThrow() {
        return ["performSavingThrow", ...this.chain(this.pick(...arguments))];
    }
}