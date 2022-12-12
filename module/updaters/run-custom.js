import { wireSocket } from "../socket.js";
import { handleError, runAndAwait } from "../utils.js";
import { Updater } from "./base-updater.js";

export class RunCustomUpdater extends Updater {
    constructor(condition, effect, item, externalTargetActor, details, handlerProperties) {
        super(condition, effect, item, externalTargetActor, details);

        this.handlerProperties = handlerProperties;
    }

    async process() {
        console.log("CUSTOM UPDATER", this.condition.update);
        if (this.handlerProperties.runAsTarget || game.user.isGM) {
            try {
                return runAndAwait(this.handlerProperties.fn, this.condition, this.item, this.effect, this.details);
            } catch (error) {
                handleError(error);
            }
        } else {
            return await wireSocket.executeAsGM("runCustomUpdater", this.condition, this.item.uuid, this.effect?.uuid, this.details);
        }
    }
}
