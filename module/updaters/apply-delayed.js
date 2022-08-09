import { Updater } from "./base.js";

export class ApplyDelayedUpdater extends Updater {
    async process() {
        console.log(this);
    }
}
