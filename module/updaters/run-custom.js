import { wireSocket } from "../socket.js";
import { Updater } from "./base-updater.js";

export class RunCustomUpdater extends Updater {
    constructor(condition, effect, item, externalTargetActor, details, handlerProperties) {
        super(condition, effect, item, externalTargetActor, details);

        this.handlerProperties = handlerProperties;
    }

    async process() {
        console.log("CUSTOM UPDATER", this.condition.update);
        if (this.handlerProperties.runAsTarget || game.user.isGM) {
            const result = this.handlerProperties.fn(this.condition, this.effect, this.details);
            if (result instanceof Promise) {
                return await result;
            }
            return result
        } else {
            return await wireSocket.executeAsGM("runCustomUpdater", condition, effect.uuid, details);
        }
    }
}
