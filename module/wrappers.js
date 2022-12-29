import { Activation } from "./activation.js";
import { ConcentrationCard } from "./cards/concentration-card.js";
import { ItemCard } from "./cards/item-card.js";
import { Flow } from "./flow.js";
import { itemRollFlow } from "./flows/item-roll.js";
import { preRollCheck, preRollConfig } from "./preroll.js";
import { fromUuid, i18n, isItemActorOnCanvas, triggerConditions } from "./utils.js";

export function setupWrappers() {
    libWrapper.register("wire", "CONFIG.Item.documentClass.prototype.use", onItemUse, "MIXED");
    libWrapper.register("wire", "ClientKeybindings._onDismiss", onEscape, "OVERRIDE");
    libWrapper.register("wire", "CONFIG.ui.chat.prototype.scrollBottom", onChatLogScrollBottom, "MIXED");
    libWrapper.register("wire", "CONFIG.Actor.documentClass.prototype._preUpdate", onActorPreUpdate, "MIXED");
}

let templateInfo = null;

async function onItemUse(wrapped, options, event) {
    let configure = true;
    if (event?.shiftKey || event?.altKey || event?.metaKey || event?.ctrlKey || event?.which === 3) {
        configure = false;
    }

    const item = this;

    if (!isItemActorOnCanvas(item)) {
        wrapped(options, event);
        return;
    }

    console.log("ROLLING ITEM", item, options);

    const concentrationEffect = item.actor.effects.find(effect => effect.getFlag("wire", "isConcentration"));
    if (concentrationEffect && item.system.components?.concentration) {
        const originName = fromUuid(concentrationEffect.origin).name;
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

    let variant;
    if (item.flags.wire?.variants?.length) {
        variant = await new game.wire.SelectVariantDialog(item, item.flags.wire.variants).render(true);
    }

    const flow = new Flow(item, "immediate", itemRollFlow, { variant });
    flow.evaluate();

    const preRollOptions = foundry.utils.mergeObject(flow.preRollOptions, { variant });
    const result = await preRollConfig(item, preRollOptions, event);

    if (result) {
        const { messageData, config, templateData } = result;
        let isPublicRoll = false;

        if (item.hasAttack) {
            if (event?.altKey) {
                setProperty(config, "attack.advantage", true);
            }
            if (event?.metaKey || event?.ctrlKey) {
                setProperty(config, "attack.disadvantage", true);
            }

            setProperty(config, "attack.useDialog", configure);
        }
    
        messageData.content = await ItemCard.renderHtml(item);
        if (game.user.isGM && !messageData.whisper.includes(game.user.id)) {
            isPublicRoll = true;
            messageData.whisper.push(game.user.id);
        }
        foundry.utils.setProperty(messageData, "flags.wire.isPrimaryRoll", true);
        foundry.utils.setProperty(messageData, "flags.wire.originatorUserId", game.user.id);
        const message = await ChatMessage.create(messageData);
    
        if (message) {
            const activation = new Activation(message);
            await activation._initialize(item, flow);
    
            await activation.assignConfig(config);
            if (templateData) {
                await activation.assignTemplateData(templateData);
            }
            await activation._activate();

            if (isPublicRoll) {
                await activation._setPublic(true);
                await activation._createPlayerMessage();
            }
        }
    
        return message;
    }
}

async function onActorPreUpdate(wrapped, change, options, user) {
    wrapped.apply(this, [change, options, user]);

    const actor = this;

    const hpUpdate = getProperty(change, "system.attributes.hp.value");
    const maxHpUpdate = getProperty(change, "system.attributes.hp.max");
    const tempUpdate = getProperty(change, "system.attributes.hp.temp");

    if (hpUpdate !== undefined || maxHpUpdate !== undefined) {
        const hp = hpUpdate === undefined ? actor.system.attributes.hp.value : hpUpdate;
        const maxHp = maxHpUpdate === undefined ? actor.system.attributes.hp.max : maxHpUpdate;
        const woundedThreshold = Math.floor(game.settings.get("wire", "wounded-threshold") * maxHp / 100);

        const isDamaged = hp < maxHp;
        const isWounded = hp <= woundedThreshold;
        const isAtZero = hp == 0;

        const needsDamaged = isDamaged && !isAtZero && !isWounded && !actor.hasPlayerOwner;
        const needsWounded = isWounded && !isAtZero && !actor.hasPlayerOwner;
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
                await combatant?.update({ defeated: needsDead });
            }
        }
    }

    if (hpUpdate !== undefined || tempUpdate !== undefined) {
        const current = actor.system.attributes.hp;
        const effectiveHp = hpUpdate !== undefined ? hpUpdate : current.value;
        const effectiveTempHp = tempUpdate !== undefined ? tempUpdate : current.temp;
        const damage = (current.value - effectiveHp) + (current.temp - effectiveTempHp);

        if (damage > 0) {
            const concentrationEffect = actor.effects.find(e => e.flags.wire?.isConcentration);
            if (effectiveHp > 0 || !game.settings.get("wire", "auto-drop-concentration")) {
                // Concentration check
                if (concentrationEffect) {
                    const concentrationCard = new ConcentrationCard(actor, concentrationEffect, { damage });
                    await concentrationCard.make();
                }
            } else {
                concentrationEffect?.delete();
            }

            // Damage taken condition
            triggerConditions(actor, "takes-damage", { details: { damageAmount: damage, hp: effectiveHp, tempHp: effectiveTempHp } });
        }
    }
}

function onEscape(context) {
    // Save fog of war if there are pending changes
    if (canvas.ready) canvas.fog.commit();

    // Dismiss an open context menu
    if (ui.context && ui.context.menu.length) {
        ui.context.close();
        return true;
    }

    // Case 2 - dismiss an open Tour
    if (Tour.tourInProgress) {
        Tour.activeTour.exit();
        return true;
      }
  
    // (GM) - release controlled objects (if not in a preview)
    if (game.user.isGM && ui.controls.activeControl !== "token" && canvas.activeLayer && Object.keys(canvas.activeLayer.controlled).length) {
        if (!canvas.activeLayer.preview?.children.length) canvas.activeLayer.releaseAll();
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

    // Toggle the main menu
    // ui.menu.toggle();

    // Save the fog immediately rather than waiting for the 3s debounced save as part of commitFog.
    if (canvas.ready) canvas.fog.save();

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
