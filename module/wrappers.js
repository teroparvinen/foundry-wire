import { Activation } from "./activation.js";
import { ConcentrationCard } from "./cards/concentration-card.js";
import { ItemCard } from "./cards/item-card.js";
import { Flow } from "./flow.js";
import { itemRollFlow } from "./flows/item-roll.js";
import { preRollCheck, preRollConfig } from "./preroll.js";
import { fromUuid, i18n, setTemplateTargeting, triggerConditions } from "./utils.js";

export function setupWrappers() {
    libWrapper.register("wire", "CONFIG.Item.documentClass.prototype.roll", onItemRoll, "MIXED");
    libWrapper.register("wire", "game.dnd5e.canvas.AbilityTemplate.prototype.activatePreviewListeners", onTemplatePreviewListeners, "MIXED");
    libWrapper.register("wire", "ClientKeybindings._onDismiss", onEscape, "OVERRIDE");
    libWrapper.register("wire", "CONFIG.ui.chat.prototype.scrollBottom", onChatLogScrollBottom, "MIXED");
    libWrapper.register("wire", "CONFIG.Actor.documentClass.prototype._preUpdate", onActorPreUpdate, "MIXED");
}

let templateInfo = null;

async function onItemRoll(wrapped, options, event) {
    if (event?.shiftKey) {
        console.log("SKIPPED WIRE", this, options);
        return wrapped(options);
    }

    const item = this;
    console.log("ROLLING ITEM", item, options);

    const concentrationEffect = item.actor.effects.find(effect => effect.getFlag("wire", "isConcentration"));
    if (concentrationEffect && item.data.data.components?.concentration) {
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

    const result = await preRollConfig(item, flow.preRollOptions, event);

    if (result) {
        const { messageData, config, template } = result;

        if (event?.altKey) { config.advantage = true; }
        if (event?.metaKey || event?.ctrlKey) { config.disadvantage = true; }

        messageData.content = await ItemCard.renderHtml(item);
        foundry.utils.setProperty(messageData, "flags.wire.originatorUserId", game.user.id);
        const message = await ChatMessage.create(messageData);
    
        if (message) {
            const activation = new Activation(message);
            await activation._initialize(item, flow);
    
            if (item.hasAreaTarget && !template) {
                templateInfo = { config, message };
            } else {
                await activation.assignConfig(config);
                if (template) {
                    await activation._assignTemplate(template);
                }
                await activation._activate();
            }
    
        }
    
        return message;
    }
}

function onTemplatePreviewListeners(wrapped, initialLayer) {
    wrapped.apply(this, [initialLayer]);

    const mdHandler = function(event) {
        Hooks.once("createMeasuredTemplate", async (templateDoc, data, user) => {
            // Many modules assume MeasuredTemplate.refresh to only happen once it has already been drawn
            // This hack delays updates which would trigger the refresh until the template has been drawn at least once
            while (!templateDoc.object?.controlIcon?.renderable) {
                await new Promise(resolve => {
                    console.log("wait");
                    setTimeout(() => { resolve(); }, 100);
                });
            }

            const activation = new Activation(templateInfo.message);
            await activation.assignConfig(templateInfo.config);
            await activation._activate();
            await activation._assignTemplate(templateDoc);
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

async function onActorPreUpdate(wrapped, change, options, user) {
    wrapped.apply(this, [change, options, user]);

    const actor = this;

    const hpUpdate = getProperty(change, "data.attributes.hp.value");
    const tempUpdate = getProperty(change, "data.attributes.hp.temp");

    if (hpUpdate !== undefined && !this.hasPlayerOwner) {
        const maxHp = actor.data.data.attributes.hp.max;
        const woundedThreshold = Math.floor(0.5 * maxHp);

        const isDamaged = hpUpdate < maxHp;
        const isWounded = hpUpdate <= woundedThreshold;
        const isAtZero = hpUpdate == 0;

        const needsDamaged = isDamaged && !isAtZero && !isWounded;
        const needsWounded = isWounded && !isAtZero;
        const needsUnconscious = actor.hasPlayerOwner && isAtZero;
        const needsDead = !actor.hasPlayerOwner && isAtZero;

        const ceApi = game.dfreds?.effectInterface;

        if (ceApi) {
            const damagedExists = ceApi.findEffectByName("Damaged");

            const hasDamaged = damagedExists && ceApi.hasEffectApplied("Damaged", actor.uuid);
            const hasWounded = ceApi.hasEffectApplied("Wounded", actor.uuid);
            const hasUnconscious = ceApi.hasEffectApplied("Unconscious", actor.uuid);
            const hasDead = ceApi.hasEffectApplied("Dead", actor.uuid);

            if (damagedExists && (needsDamaged != hasDamaged)) { await ceApi.toggleEffect("Damaged", { uuids: [actor.uuid] }); }
            if (needsWounded != hasWounded) { await ceApi.toggleEffect("Wounded", { uuids: [actor.uuid] }); }
            if (needsUnconscious != hasUnconscious) { await ceApi.toggleEffect("Unconscious", { uuids: [actor.uuid] }); }
            if (needsDead != hasDead) {
                await ceApi.toggleEffect("Dead", { uuids: [actor.uuid], overlay: true });
                
                const combatant = actor.token ? game.combat?.getCombatantByToken(actor.token.id) : game.combat?.getCombatantByActor(actor.id);
                await combatant.update({ defeated: needsDead });
            }
        }
    }

    if (hpUpdate !== undefined || tempUpdate !== undefined) {
        const current = actor.data.data.attributes.hp;
        const damage = (current.value - (hpUpdate || current.value)) + (current.temp - (tempUpdate || current.temp));

        if (damage > 0) {
            // Concentration check
            const concentrationEffect = actor.effects.find(e => e.data.flags.wire?.isConcentration);
            if (concentrationEffect) {
                const concentrationCard = new ConcentrationCard(actor, concentrationEffect, damage);
                await concentrationCard.make();
            }

            // Damage taken condition
            triggerConditions(actor, "takes-damage");
        }
    }
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
    if (ui.controls.activeControl !== "token" || ui.controls.activeTool !== "select") {
        if (game.user.isGM && canvas.activeLayer && canvas.activeLayer !== canvas.tokens) {
            canvas.activeLayer.deactivate();
        }

        canvas.tokens.activate();
        ui.controls.control.activeTool = "select";
        setTimeout(() => { ui.controls.render(); }, 1);
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

let didStart = false;

function onChatLogScrollBottom(wrapped, {popout}={}) {
    if (!didStart) {
        wrapped({ popout });
        didStart = true;
    } else {
        const el = this.element;
        const log = el.length ? el[0].querySelector("#chat-log") : null;
    
        const scrolled = log.scrollHeight - log.scrollTop - log.clientHeight;
        const pageHeight = log.clientHeight;
    
        if (log && scrolled < pageHeight) log.scrollTop = log.scrollHeight;
        if (popout) this._popout?.scrollBottom();
    }
}
