import { applyTargetEffects } from "../game/active-effects.js";
import { Updater } from "./base-updater.js";

export class ApplyEffectsUpdater extends Updater {
    constructor(condition, effect, item, externalTargetActor) {
        super(condition, effect, item, externalTargetActor)

        const applicationTypes = {
            "apply-effects-immediate": "immediate",
            "apply-effects-delayed": "delayed",
            "apply-effects-overtime": "overtime"
        }
        this.applicationType = applicationTypes[condition.update];
    }

    async process() {
        const masterEffect = this.item.actor.effects.find(e => e.data.origin === this.item.uuid && e.data.flags.wire?.isMasterEffect);
        await applyTargetEffects(this.item, this.applicationType, [this.externalTargetActor], [this.externalTargetActor], masterEffect);
    }
}
