import { itemRollFlow } from "../flows/item-roll.js";
import { Updater } from "./base-updater.js";

export class ApplySecondaryUpdater extends Updater {
    constructor(condition, effect, item, externalTargetActor) {
        super(condition, effect, item, externalTargetActor)

        this.applicationType = condition.update === "apply-delayed" ? "delayed" : "overtime";
    }

    flow() {
        return itemRollFlow.apply(this);
    }
}
