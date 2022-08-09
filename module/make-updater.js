import { ApplyDelayedUpdater } from "./updaters/apply-delayed.js";
import { EndOnSaveUpdater } from "./updaters/end-on-save.js";

export function makeUpdater(update, effect, actor, item) {
    if (update === "apply-delayed") { return new ApplyDelayedUpdater(update, effect, actor, item); }
    if (update === "end-on-save") { return new EndOnSaveUpdater(update, effect, actor, item); }
}
