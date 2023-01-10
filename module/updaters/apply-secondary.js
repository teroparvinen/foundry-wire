import { itemRollFlow } from "../flows/item-roll.js";
import { Updater } from "./base-updater.js";

export class ApplySecondaryUpdater extends Updater {
    constructor(condition, effect, item, externalTargetActor, details, activationConfig) {
        super(condition, effect, item, externalTargetActor, details, activationConfig);

        const applicationTypes = {
            "apply-immediate": "immediate",
            "apply-delayed": "delayed",
            "apply-overtime": "overtime"
        }

        this.applicationType = applicationTypes[condition.update];
        this.allowFlowMacro = true;
    }

    flow() {
        return itemRollFlow.apply(this);
    }
}
