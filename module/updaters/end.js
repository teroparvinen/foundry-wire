import { Updater } from "./base-updater.js";

export class EndUpdater extends Updater {
    async process() {
        await this.effect.delete();
    }
}
