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

    async process(targetActor) {
        const messageData = await this.item.displayCard({ createMessage: false });
        messageData.content = await ItemCard.renderHtml(this.item, null, { isSecondary: true });
        messageData.speaker = getSpeaker(this.item.actor);
        foundry.utils.setProperty(messageData, "flags.wire.originatorUserId", this.effect.data.flags.wire?.originatorUserId);
        const message = await ChatMessage.create(messageData);

        const flow = new Flow(this.item, this.applicationType, this.flow);
            
        if (message) {
            const activation = new Activation(message);

            if (this.item.hasPlayerOwner) {
                activation.createPlayerMessage();
            }

            await activation.initialize(this.item, this.applicationType, flow, this.effect, targetActor.uuid);
            await activation.activate();
        }
    }
}