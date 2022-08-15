import { Activation } from "./activation.js";
import { ItemCard } from "./cards/item-card.js";
import { Flow } from "./flow.js";
import { itemRollFlow } from "./flows/item-roll.js";
import { preRollCheck, preRollConfig } from "./preroll.js";
import { fromUuid, i18n, setTemplateTargeting } from "./utils.js";

export function setupWrappers() {
    libWrapper.register("wire", "CONFIG.Item.documentClass.prototype.roll", onItemRoll, "MIXED");
    libWrapper.register("wire", "game.dnd5e.canvas.AbilityTemplate.prototype.activatePreviewListeners", onTemplatePreviewListeners, "MIXED");
    libWrapper.register("wire", "ClientKeybindings._onDismiss", onEscape, "OVERRIDE");
    libWrapper.register("wire", "CONFIG.ui.chat.prototype.scrollBottom", onChatLogScrollBottom, "OVERRIDE");
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

function onEscape(context) {
    // Save fog of war if there are pending changes
    if (canvas.ready) canvas.sight.commitFog();

    // Dismiss an open context menu
    if (ui.context && ui.context.menu.length) {
        ui.context.close();
        return true;
    }

    // Return to chat tab
    if (ui.sidebar.activeTab !== "chat") {
        ui.sidebar.activateTab("chat");
        return true;
    }

    // Return to token controls
    if (ui.controls.activeControl !== "token") {
        canvas.tokens.activate();
        return true;
    }

    // Release targets
    if (game.user.targets.size) {
        [...game.user.targets][0].setTarget(false);
        return true;
    }

    // // Close open UI windows
    // if (Object.keys(ui.windows).length) {
    //     Object.values(ui.windows).forEach(app => app.close());
    //     return true;
    // }

    // // (GM) - release controlled objects (if not in a preview)
    // if (game.user.isGM && canvas.activeLayer && Object.keys(canvas.activeLayer._controlled).length) {
    //     if (!canvas.activeLayer.preview?.children.length) canvas.activeLayer.releaseAll();
    //     return true;
    // }

    // Toggle the main menu
    // ui.menu.toggle();

    // Save the fog immediately rather than waiting for the 3s debounced save as part of commitFog.
    if (canvas.ready) canvas.sight.saveFog();
    return true;
}

function onChatLogScrollBottom({popout}={}) {
    const el = this.element;
    const log = el.length ? el[0].querySelector("#chat-log") : null;

    const scrolled = log.scrollHeight - log.scrollTop - log.clientHeight;
    const pageHeight = log.clientHeight;

    if (log && scrolled < pageHeight) log.scrollTop = log.scrollHeight;
    if (popout) this._popout?.scrollBottom();
}
