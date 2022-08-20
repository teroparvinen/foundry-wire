import { itemRollFlow } from "../flows/item-roll.js";
import { Updater } from "./base-updater.js";

export class ApplySecondaryUpdater extends Updater {
    constructor(condition, effect, item, externalTargetActor, details) {
        super(condition, effect, item, externalTargetActor, details)

        this.applicationType = condition.update === "apply-delayed" ? "delayed" : "overtime";
        this.allowFlowMacro = true;
    }

    flow() {
        return itemRollFlow.apply(this);
    }
}
