import { Activation } from "../activation.js";
import { ItemCard } from "../cards/item-card.js";
import { Flow } from "../flow.js";
import { getSpeaker } from "../utils.js";

export class Updater {
    constructor(update, effect, actor, item) {
        this.update = update;
        this.effect = effect;
        this.actor = actor;
        this.item = item;

        this.applicationType = "immediate";
    }

    async process() {
        const flow = new Flow(this.item, this.applicationType, this.flow);
        Activation.createConditionMessage(this.item, this.effect, flow, this.actor)
    }
}