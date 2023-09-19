import { areaEffectFlow } from "./flows/area-effect.js";
import { itemRollFlow } from "./flows/item-roll.js";
import { singleTargetFlow } from "./flows/single-target.js";
import { hasConcentration, hasDamageOfType, hasDuration, hasEffectsOfType, hasSaveableApplicationsOfType, isAreaTargetable, isAttack, isAura, isSave, isSelfTarget, isTokenTargetable } from "./item-properties.js";
import { handleError, isAuraEffect } from "./utils.js";

export class Flow {
    constructor(item, applicationType, evaluator, { variant = null, allowMacro = true, isConditionTriggered = false } = {}) {
        this.item = item;
        this.applicationType = applicationType;
        this.evaluator = evaluator;
        this.variant = variant;
        this.allowMacro = allowMacro;
        this.isConditionTrigger = isConditionTriggered;

        const scriptContent = item?.flags.wire?.script?.trim();
        if (scriptContent) {
            try {
                this.macroFunction = new Function(scriptContent);
            } catch (error) {
                handleError(error);
            }
        }

        this.preRollOptions = {};
        this.customSteps = {};
        this.customUpdaters = {};
    }

    evaluate() {
        let result;
        if (this.allowMacro && this.macroFunction) {
            try {
                result = this.macroFunction.apply(this);
            } catch (error) {
                handleError(error);
            }
        }
        if (!result && this.evaluator) {
            result = this.evaluator.apply(this);
        }
        
        const steps = result;
        this.isEvaluated = true;
        this.evaluatedSteps = steps;
        return steps;
    }

    chain(input) {
        if (Array.isArray(input)) {
            return input;
        } else if (input) {
            return [input]
        }
        return [];
    }

    registerFlowStep(name, runAsRoller, fn) {
        this.customSteps[`custom:${name}`] = {
            runAsRoller,
            fn
        };
    }

    registerUpdater(name, runAsTarget, fn) {
        this.customUpdaters[name] = {
            runAsTarget,
            fn
        };
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
        return this.pick(...arguments).flat();
    }

    sequence() {
        return [...arguments].filter(a => a).flat();
    }

    performCustomStep(name, ...args) {
        return [`custom:${name}`, ...this.chain(this.pick(...args))];
    }

    // Item information

    hasAreaTarget() {
        if (isAreaTargetable(this.item)) {
            return this.pick(...arguments);
        }
    }

    hasAuraOrAreaTarget() {
        if (isAreaTargetable(this.item) || isAura(this.item)) {
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

    isConditionTriggered() {
        if (this.isConditionTrigger) {
            return this.pick(...arguments);
        }
    }

    isDelayedApplication() {
        if (this.applicationType === "delayed") {
            return this.pick(...arguments);
        }
    }

    isImmediateApplication() {
        if (this.applicationType === "immediate") {
            return this.pick(...arguments);
        }
    }

    isOverTimeApplication() {
        if (this.applicationType === "overtime") {
            return this.pick(...arguments);
        }
    }

    isSave() {
        if (isSave(this.item)) {
            return this.pick(...arguments);
        }
    }

    isSelfTarget() {
        if (isSelfTarget(this.item) || isAura(this.item)) {
            return this.pick(...arguments);
        }
    }

    isTokenTargetable() {
        if (isTokenTargetable(this.item)) {
            return this.pick(...arguments);
        }
    }

    isVariant(variant) {
        if (this.variant === variant) {
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

    applyDefaultTargetsAsEffective() {
        return ["applyDefaultTargetsAsEffective", ...this.chain(this.pick(...arguments))];
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

    applySelectedTargetsAlliesAsEffective() {
        return ["applySelectedTargetsAlliesAsEffective", ...this.chain(this.pick(...arguments))];
    }

    applySelectedTargetsAsEffective() {
        return ["applySelectedTargetsAsEffective", ...this.chain(this.pick(...arguments))];
    }

    applyTargetFromCondition() {
        return ["applyTargetFromCondition", ...this.chain(this.pick(...arguments))];
    }

    applyTargetFromConditionAsEffective() {
        return ["applyTargetFromConditionAsEffective", ...this.chain(this.pick(...arguments))];
    }

    attackCompleted() {
        return ["attackCompleted", ...this.chain(this.pick(...arguments))];
    }

    confirmTargets() {
        return ["confirmTargets", ...this.chain(this.pick(...arguments))];
    }

    detachTemplate() {
        return ["detachTemplate", ...this.chain(this.pick(...arguments))];
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

    performSavingThrowAlways() {
        return ["performSavingThrowAlways", ...this.chain(this.pick(...arguments))];
    }

    placeTemplate() {
        return ["placeTemplate", ...this.chain(this.pick(...arguments))];
    }

    promptVariant() {
        return ["promptVariant", ...this.chain(this.pick(...arguments))];
    }

    removeSelfTarget() {
        return ["removeSelfTarget", ...this.chain(this.pick(...arguments))];
    }

    removeTemplate() {
        return ["removeTemplate", ...this.chain(this.pick(...arguments))];
    }

    triggerAction() {
        return ["triggerAction", ...this.chain(this.pick(...arguments))];
    }

    // Prepared flows

    defaultFlow() {
        const steps = itemRollFlow.apply(this) || [];
        return [...steps, ...this.chain(this.pick(...arguments))];
    }

    areaEffectFlow(options = {}) {
        const steps = areaEffectFlow.apply(this, [options]) || [];
        return [...steps, ...this.chain(this.pick(...arguments))];
    }

    singleTargetFlow(options = {}) {
        const steps = singleTargetFlow.apply(this, [options]) || [];
        return [...steps, ...this.chain(this.pick(...arguments))];
    }

    // Pre-roll options

    requestCustomConfiguration(callback) {
        this.preRollOptions["customConfigurationCallback"] = callback;
    }

    selectVariant() {
        this.preRollOptions["variantOptions"] = Array.isArray(arguments[0]) ? arguments[0] : [...arguments];
    }

    skipConfigurationDialog() {
        this.preRollOptions["skipConfigurationDialog"] = true;
    }

    skipTemplatePlacement() {
        this.preRollOptions["skipTemplatePlacement"] = true;
    }

    skipVariantSelection() {
        this.preRollOptions["skipVariantSelection"] = true;
    }

    setTemplateTargetSelection(state) {
        this.preRollOptions["disableTemplateTargetSelection"] = !state;
    }
}