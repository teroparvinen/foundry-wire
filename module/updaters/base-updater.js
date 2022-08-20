import { Activation } from "../activation.js";
import { ItemCard } from "../cards/item-card.js";
import { Flow } from "../flow.js";
import { getSpeaker } from "../utils.js";

export class Updater {
    constructor(condition, effect, item, externalTargetActor, details) {
        this.condition = condition;
        this.effect = effect;
        this.item = item;
        this.externalTargetActor = externalTargetActor;
        this.details = details;

        this.applicationType = "immediate";
        this.allowFlowMacro = false;
    }

    async process() {
        const flow = new Flow(this.item, this.applicationType, this.flow, { allowMacro: this.allowFlowMacro });
        const condition = foundry.utils.mergeObject(this.condition, this.details ? { details: this.details } : {});
        await Activation.createConditionMessage(this.condition, this.item, this.effect, flow, { externalTargetActor: this.externalTargetActor });
    }
}