import { hasApplicationsOfType, hasSelfAttachableAreaTarget } from "./item-properties.js";
import { evaluateFormula, getActorToken, getTokenSceneUnitSize, setTemplateTargeting } from "./utils.js";

export function initTemplateHooks() {
    Hooks.on("updateToken", async (tokenDoc, changes, options, user) => {
        if (changes.width || changes.height) {
            const attachedTemplate = canvas.templates.get(tokenDoc.flags.wire?.attachedTemplateId);
            if (attachedTemplate) {
                const originalDistance = attachedTemplate.document.flags.wire?.originalDistance || attachedTemplate.document.distance;
                const center = tokenDoc.object.center;
                await attachedTemplate.document.update({
                    x: center.x,
                    y: center.y,
                    distance: originalDistance + getTokenSceneUnitSize(tokenDoc.object) * 0.5
                })
            }
        }
    });
}

export function setupTemplateWrappers() {
    libWrapper.register("wire", "MeasuredTemplate.prototype._refreshRulerText", onTemplateRefreshRulerText, "MIXED");
}

function onTemplateRefreshRulerText(wrapped) {
    const attachedToken = canvas.tokens.get(this.document.flags?.wire?.attachedTokenId);
    if (attachedToken && this.document.t === "circle") {
        const u = canvas.scene.grid.units;
        const d = Math.round((this.document.distance - getTokenSceneUnitSize(attachedToken) * 0.5) * 10) / 10;
        const text = `${d}${u}`;
        this.ruler.text = text;
        this.ruler.position.set(this.ray.dx + 10, this.ray.dy + 5);
        this.ruler.visible = this.layer.active && this.isVisible;
    } else {
        wrapped();
    }
}

async function evaluateTemplateFormulas(item, templateData, config, { distanceOffset = 0 } = {}) {
    const rollData = foundry.utils.mergeObject(item.getRollData(), config);
    
    const targetValue = getProperty(item, "flags.wire.override.target.value") || getProperty(item, "system.target.value");
    if (targetValue) {
        let distance = evaluateFormula(targetValue, rollData);
        if (templateData.t == "rect") {
            distance = Math.hypot(distance, distance);
        }
        distance += distanceOffset;
        await templateData.updateSource({ distance });
    }
}

export async function createTemplate(item, config, applicationType, { disableTemplateTargetSelection = false, preventCancel = false }) {
    const selectTargets = !disableTemplateTargetSelection && hasApplicationsOfType(item, applicationType, config?.variant);
    
    if (hasSelfAttachableAreaTarget(item)) {
        await setTemplateTargeting(selectTargets);
        
        const token = getActorToken(item.actor);
        if (token) {
            const destination = canvas.grid.getSnappedPosition(token.x, token.y, 2);
            destination.x = destination.x + token.w / 2;
            destination.y = destination.y + token.h / 2;
            const preTemplate = game.dnd5e.canvas.AbilityTemplate.fromItem(item);
            await evaluateTemplateFormulas(item, preTemplate.document, config, { distanceOffset: getTokenSceneUnitSize(token) * 0.5 });
            await preTemplate.document.updateSource(destination);
            
            await preTemplate.draw();
            await preTemplate.destroy();
            
            return foundry.utils.mergeObject(preTemplate.document.toObject(), { 
                "flags.wire.attachedTokenId": token.id,
                "flags.wire.originalDistance": preTemplate.document.distance,
                distance: preTemplate.document.distance
            });
        }
        
        await setTemplateTargeting(false);
    } else {
        return await placeTemplate(item, config, { selectTargets, preventCancel });
    }
}

export async function placeTemplate(item, config, { selectTargets = true, preventCancel = false } = {}) {
    let template;
    if (item instanceof CONFIG.Item.documentClass) {
        template = game.dnd5e.canvas.AbilityTemplate.fromItem(item);
        await evaluateTemplateFormulas(item, template.document, config);
    } else {
        const cls = CONFIG.MeasuredTemplate.documentClass;
        const templateObject = new cls(item, {parent: canvas.scene});
        template = new game.dnd5e.canvas.AbilityTemplate(templateObject);
    }
    
    if (template) {
        const initialLayer = canvas.activeLayer;
        
        await setTemplateTargeting(false);
        
        // Draw the template and switch to the template layer
        await template.draw();
        template.layer.activate();
        template.layer.preview.addChild(template);
        
        // Hide the sheet that originated the preview
        template.actorSheet?.minimize();
        
        // Activate interactivity
        return new Promise(async (resolve, reject) => {
            const handlers = {};
            let moveTime = 0;
            
            const dismiss = async (event) => {
                await setTemplateTargeting(false);
                template.layer._onDragLeftCancel(event);
                canvas.stage.off("mousemove", handlers.mm);
                canvas.stage.off("mousedown", handlers.lc);
                canvas.app.view.oncontextmenu = null;
                canvas.app.view.onwheel = null;
                initialLayer.activate();
                template.actorSheet?.maximize();
                template.destroy();
            }
            
            // Update placement (mouse-move)
            handlers.mm = async event => {
                event.stopPropagation();
                await setTemplateTargeting(selectTargets);
                let now = Date.now(); // Apply a 20ms throttle
                if (now - moveTime <= 20) return;
                const center = event.data.getLocalPosition(template.layer);
                const snapped = canvas.grid.getSnappedPosition(center.x, center.y, 2);
                template.document.updateSource({ x: snapped.x, y: snapped.y });
                template.refresh();
                moveTime = now;
            };
            
            // Cancel the workflow (right-click)
            handlers.rc = async event => {
                if (!preventCancel) {
                    await dismiss(event);
                    resolve(null);
                }
            };
            
            // Confirm the workflow (left-click)
            handlers.lc = async event => {
                await dismiss(event);
                const destination = canvas.grid.getSnappedPosition(template.document.x, template.document.y, 2);
                await template.document.updateSource(destination);
                await setTemplateTargeting(false);
                resolve(template.document.toObject());
            };
            
            // Rotate the template by 3 degree increments (mouse-wheel)
            handlers.mw = event => {
                if (event.ctrlKey) event.preventDefault(); // Avoid zooming the browser window
                event.stopPropagation();
                let delta = canvas.grid.type > CONST.GRID_TYPES.SQUARE ? 30 : 15;
                let snap = event.shiftKey ? delta : (event.altKey ? 0.5 : 5);
                const update = { direction: template.document.direction + (snap * Math.sign(event.deltaY)) };
                template.document.updateSource(update);
                template.refresh();
            };
            
            // Activate listeners
            canvas.stage.on("mousemove", handlers.mm);
            canvas.stage.on("mousedown", handlers.lc);
            canvas.app.view.oncontextmenu = handlers.rc;
            canvas.app.view.onwheel = handlers.mw;
            
            template.refresh();
        });
    }
}
