import { Activation } from "../activation.js";
import { ItemCard } from "../cards/item-card.js";
import { Flow } from "../flow.js";
import { getSpeaker } from "../utils.js";

export class Updater {
    constructor(condition, effect, item, externalTargetActor) {
        this.condition = condition;
        this.effect = effect;
        this.externalTargetActor = externalTargetActor;
        this.item = item;

        this.applicationType = "immediate";
    }

    async process() {
        const flow = new Flow(this.item, this.applicationType, this.flow);
        Activation.createConditionMessage(this.condition, this.item, this.effect, flow, { externalTargetActor: this.externalTargetActor });
    }
}