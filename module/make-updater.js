import { ApplySecondaryUpdater } from "./updaters/apply-secondary.js";
import { EndOnSaveUpdater } from "./updaters/end-on-save.js";
import { EndUpdater } from "./updaters/end.js";

export function makeUpdater(update, effect, actor, item) {
    switch (update) {
    case "apply-delayed":
    case "apply-overtime":
        return new ApplySecondaryUpdater(update, effect, actor, item);
        break;
    case "end":
        return new EndUpdater(update, effect, actor, item);
        break;
    case "end-on-save":
        return new EndOnSaveUpdater(update, effect, actor, item);
        break;
    default:
        console.warn("MISSING UPDATER", update);
    }
}
