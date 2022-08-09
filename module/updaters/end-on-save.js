import { Updater } from "./base.js";

export class EndOnSaveUpdater extends Updater {
    async process() {
        console.log(this);
    }
}
