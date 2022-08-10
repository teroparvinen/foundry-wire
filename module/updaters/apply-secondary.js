import { applySecondaryFlow } from "../flows/apply-secondary.js";
import { Updater } from "./base-updater.js";

export class ApplySecondaryUpdater extends Updater {
    constructor(update, effect, actor, item) {
        super(update, effect, actor, item)

        this.applicationType = update === "apply-delayed" ? "delayed" : "overtime";
    }

    flow() {
        return applySecondaryFlow.apply(this);
    }
}
