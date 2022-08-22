import { applyTargetEffects } from "../game/active-effects.js";
import { determineUpdateTargets } from "../updater-utility.js";
import { Updater } from "./base-updater.js";

export class ApplyEffectsUpdater extends Updater {
    constructor(condition, effect, item, externalTargetActor, details) {
        super(condition, effect, item, externalTargetActor, details);

        const applicationTypes = {
            "apply-effects-immediate": "immediate",
            "apply-effects-delayed": "delayed",
            "apply-effects-overtime": "overtime"
        }
        this.applicationType = applicationTypes[condition.update];
    }

    async process() {
        const masterEffect = this.item.actor.effects.find(e => e.data.origin === this.item.uuid && e.data.flags.wire?.isMasterEffect);
        const activationConfig = this.effect?.data.flags.wire?.activationConfig;
        const targets = determineUpdateTargets(this.item, this.effect, this.condition, this.externalTargetActor);
        await applyTargetEffects(this.item, this.applicationType, targets, targets, masterEffect, activationConfig);
    }
}
