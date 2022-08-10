import { Updater } from "./base-updater.js";

export class EndUpdater extends Updater {
    flow() {
        return this.endEffect()
    }
}
