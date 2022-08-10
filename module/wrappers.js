import { Activation } from "./activation.js";
import { ItemCard } from "./cards/item-card.js";
import { Resolver } from "./resolver.js";
import { Flow } from "./flow.js";
import { itemRollFlow } from "./flows/item-roll.js";

export function setupWrappers() {
    libWrapper.register("wire", "CONFIG.Item.documentClass.prototype.roll", onItemRoll, "MIXED");
    libWrapper.register("wire", "ClientKeybindings._onDismiss", onEscape, "MIXED");
    libWrapper.register("wire", "game.dnd5e.canvas.AbilityTemplate.prototype.activatePreviewListeners", onTemplatePreviewListeners, "MIXED");
}

let messageWaitingForTemplate = null;

async function onItemRoll(wrapped, options) {
    const item = this;
    console.log("ROLLING ITEM", item, options);

    if (!Resolver.check(item)) {
        return;
    }

    const flow = new Flow(item, "immediate");
    const flowSteps = flow.evaluate(itemRollFlow);

    const messageData = await wrapped(foundry.utils.mergeObject(options || {}, { createMessage: false }));
    if (messageData) {
        messageData.content = await ItemCard.renderHtml(item);
        foundry.utils.setProperty(messageData, "flags.wire.originatorUserId", game.user.id);
        const message = await ChatMessage.create(messageData);
    
        if (message) {
            const activation = new Activation(message);
            await activation.initialize(item, "immediate", flowSteps);
    
            if (item.hasAreaTarget) {
                messageWaitingForTemplate = message;
            } else {
                await activation.activate();
            }
    
        }
    
        return message;
    }
}

function onEscape(wrapped, context) {
    if (!(ui.context && ui.context.menu.length) && !((Object.keys(ui.windows).length))) {
        if (ui.controls.activeControl !== "token") {
            canvas.tokens.activate();
            return true;
        }

        if (game.user.targets.size) {
            [...game.user.targets][0].setTarget(false);
            return true;
        }
    }

    return wrapped.apply(this, [context]);
}

function onTemplatePreviewListeners(wrapped, initialLayer) {
    wrapped.apply(this, [initialLayer]);

    const mdHandler = function(event) {
        Hooks.once("createMeasuredTemplate", async (templateDoc, data, user) => {
            const activation = new Activation(messageWaitingForTemplate);
            await activation.activate();
            await activation.assignTemplate(templateDoc);
            messageWaitingForTemplate = null;
            canvas.stage.off("mousedown", mdHandler);
        });
    };
    canvas.stage.on("mousedown", mdHandler);

    const cmListener = canvas.app.view.oncontextmenu;
    canvas.app.view.oncontextmenu = function(event) {
        messageWaitingForTemplate?.delete();
        messageWaitingForTemplate = null;
        canvas.stage.off("mousedown", mdHandler);
        cmListener?.apply(this, arguments);
    };
}
