import { Activation } from "./activation.js";
import { ItemCard } from "./cards/item-card.js";
import { Flow } from "./flow.js";
import { itemRollFlow } from "./flows/item-roll.js";
import { preRollCheck, preRollConfig } from "./preroll.js";
import { fromUuid, i18n, setTemplateTargeting } from "./utils.js";

export function setupWrappers() {
    libWrapper.register("wire", "CONFIG.Item.documentClass.prototype.roll", onItemRoll, "MIXED");
    libWrapper.register("wire", "ClientKeybindings._onDismiss", onEscape, "MIXED");
    libWrapper.register("wire", "game.dnd5e.canvas.AbilityTemplate.prototype.activatePreviewListeners", onTemplatePreviewListeners, "MIXED");
    libWrapper.register("wire", "CONFIG.Actor.documentClass.prototype.prepareDerivedData", onActorPrepareDerivedData, "MIXED");
}

let templateInfo = null;

async function onItemRoll(wrapped, options) {
    const item = this;
    console.log("ROLLING ITEM", item, options);

    const concentrationEffect = item.actor.effects.find(effect => effect.getFlag("wire", "isConcentration"));
    if (concentrationEffect) {
        const originName = fromUuid(concentrationEffect.data.origin).name;
        if (!await Dialog.confirm({
            title: i18n("wire.ui.end-concentration-dialog-title"),
            content: i18n("wire.ui.end-concentration-dialog-content", { originName })
        })) {
            return;
        }
    }

    if (!preRollCheck(item)) {
        return;
    }

    const flow = new Flow(item, "immediate", itemRollFlow);
    flow.evaluate();

    const result = await preRollConfig(item, flow.preRollOptions);

    if (result) {
        const { messageData, config, template } = result;

        messageData.content = await ItemCard.renderHtml(item);
        foundry.utils.setProperty(messageData, "flags.wire.originatorUserId", game.user.id);
        const message = await ChatMessage.create(messageData);
    
        if (message) {
            const activation = new Activation(message);
            await activation.initialize(item, "immediate", flow);
    
            if (item.hasAreaTarget && !template) {
                templateInfo = { config, message };
            } else {
                await activation.assignConfig(config);
                if (template) {
                    await activation.assignTemplate(template);
                }
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
            const activation = new Activation(templateInfo.message);
            await activation.assignConfig(templateInfo.config);
            await activation.activate();
            await activation.assignTemplate(templateDoc);
            templateInfo = null;
            canvas.stage.off("mousedown", mdHandler);
            setTemplateTargeting(false);
        });
    };
    canvas.stage.on("mousedown", mdHandler);

    const cmListener = canvas.app.view.oncontextmenu;
    canvas.app.view.oncontextmenu = function(event) {
        templateInfo.message?.delete();
        templateInfo = null;
        canvas.stage.off("mousedown", mdHandler);
        cmListener?.apply(this, arguments);
        setTemplateTargeting(false);
    };
}

function onActorPrepareDerivedData(wrapped, ...args) {
    wrapped.apply(this, [...args]);

    // TODO: necessary?
}