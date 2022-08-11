import { Updater } from "./base-updater.js";

export class EndUpdater extends Updater {
    async process(targetActor) {
        await this.effect.delete();
    }
}
