import { i18n } from "../utils.js";
import { injectConditionList } from "./condition-list.js";

function shouldForceTargetAndRange(item) {
    return !item.system.activation?.type && (item.effects.find(e => e.transfer) || item.flags.wire?.conditions?.length);
}

export function initItemSheetHooks() {
    Hooks.on("renderItemSheet5e", async (app, html, data) => {
        const item = app.object;

        const stockTargetValue = foundry.utils.getProperty(item, "system.target.value");
        const targetValue = foundry.utils.getProperty(item, "flags.wire.override.target.value") || stockTargetValue;

        const disabled = app.isEditable ? "" : "disabled";

        const selected = (value, fieldValue) => { return value === fieldValue ? "selected" : "" };

        const usageInsertPoint = html.find('.tab.details select[name="system.activation.type"]').closest('.form-group').next('h3');

        if (item.system.activation.type) {
            // Variants
            const variants = item.flags.wire?.variants || [];
            const variantRows = variants.map((v, i) => {
                return `
                    <li class="variant-row flexrow" data-variant="${i}">
                        <input type="text" name="flags.wire.variants.${i}" value="${v}" />
                        <a class="variant-control delete-variant"><i class="fas fa-minus"></i></a>
                    </li>
                `;
            }).join("");
            const variantHtml = `
                <h4 class="variant-header">
                    ${i18n("wire.item.variant-header")}
                    <a class="variant-control add-variant"><i class="fas fa-plus"></i></a>
                </h4>
                <ol class="variant-rows form-group">
                    ${variantRows}
                </ol>
            `;
            usageInsertPoint.before(variantHtml);
    
            html.find('.add-variant').click(async (event) => {
                const variants = item.getFlag("wire", "variants") || [];
                variants.push("");
                await item.setFlag("wire", "variants", variants);
            });
            html.find('.delete-variant').click(async (event) => {
                const i = event.target.closest('.variant-row').dataset.variant;
                const variants = item.getFlag("wire", "variants") || [];
                variants.splice(i, 1);
                await item.setFlag("wire", "variants", variants);
            });
        } else if (shouldForceTargetAndRange(item)) {
            const targetTypes = CONFIG.DND5E.targetTypes;
            const distanceUnits = CONFIG.DND5E.distanceUnits;

            const targetType = item.system.target?.type;
            const targetUnits = item.system.target?.units;
            const rangeUnit = item.system.range?.units;

            const targetTypeOptions = Object.entries(targetTypes).map(e => `<option value="${e[0]}" ${selected(targetType, e[0])}>${e[1]}</option>`).join("");
            const targetUnitOptions = Object.entries(distanceUnits).map(e => `<option value="${e[0]}" ${selected(targetUnits, e[0])}>${e[1]}</option>`).join("");
            const rangeUnitOptions = Object.entries(distanceUnits).map(e => `<option value="${e[0]}" ${selected(rangeUnit, e[0])}>${e[1]}</option>`).join("");

            const fields = `
                <div class="form-group input-select-select">
                    <label>${i18n("DND5E.Target")}</label>
                    <div class="form-fields">
                        <input type="number" step="any" name="flags.wire.override.target.value" value="${targetValue}" placeholder="—">
                        <select name="system.target.units">
                            <option value=""></option>
                            ${targetUnitOptions}
                        </select>
                        <select name="system.target.type">
                            <option value=""></option>
                            ${targetTypeOptions}
                        </select>
                    </div>
                </div>
                <div class="form-group input-select">
                    <label>${i18n("DND5E.Range")}</label>
                    <div class="form-fields">
                        <input type="number" step="any" name="system.range.value" value="${item.system.range?.value || ''}" placeholder="Normal">
                        <span class="sep">/</span>
                        <input type="number" step="any" name="system.range.long" value="${item.system.range?.long || ''}" placeholder="Max">
                        <select name="system.range.units">
                            <option value=""></option>
                            ${rangeUnitOptions}
                        </select>
                    </div>
                </div>
            `;

            usageInsertPoint.before(fields);
        }

        // Allow formula for target
        html.find('input[name="system.target.value"]')
            .attr("type", "text")
            .attr("name", "flags.wire.override.target.value")
            .val(targetValue);

        // Damage parts
        const parts = item.system.damage?.parts || [];
        const wireParts = item.flags.wire?.damageParts || [];
        
        html.find('.damage-part').each(function() {
            const i = this.dataset.damagePart;
            const halving = wireParts[i]?.halving || parts[i]["halving"];
            const application = wireParts[i]?.application || parts[i]["application"];
            const fields = `
                <select name="system.damage.parts.${i}.halving" ${disabled}>
                    <option value="none">${i18n("wire.item.damage-none")}</option>
                    <option value="half" ${selected(halving, "half")}>${i18n("wire.item.damage-half")}</option>
                    <option value="full" ${selected(halving, "full")}>${i18n("wire.item.damage-full")}</option>
                </select>
                <select name="system.damage.parts.${i}.application" ${disabled}>
                    <option value="immediate">${i18n("wire.item.application-immediate")}</option>
                    <option value="delayed" ${selected(application, "delayed")}>${i18n("wire.item.application-delayed")}</option>
                    <option value="overtime" ${selected(application, "overtime")}>${i18n("wire.item.application-overtime")}</option>
                </select>
            `;
            $(this).find('.delete-damage').before(fields);
        });

        // Shorten temp healing title
        html.find('.damage-parts option[value="temphp"]').each(function() {
            if ($(this).text() === "Healing (Temporary)") $(this).text("Healing (Temp)");
        });

        // Checked ability
        const checkedAbility = item.flags.wire?.checkedAbility;
        const abilityOptions = Object.entries(CONFIG.DND5E.abilities).map(a => `<option value="${a[0]}" ${selected(checkedAbility, a[0])}>${a[1]}</option>`)
        html.find('.damage-parts').nextAll('.input-select').first().after(`
            <div class="form-group input-select">
                <label>${i18n("wire.ui.ability-check")}</label>
                <div class="form-fields">
                    <select name="flags.wire.checkedAbility" ${disabled}>
                        <option value="">${i18n("wire.ui.use-save-for-check")}</option>
                        ${abilityOptions}
                    </select>
                    <div style="flex: 4"></div>
                </div>
            </div>
        `);

        // Spell scaling interval
        if (item.system.scaling?.mode === "level") {
            const interval = item.flags.wire?.upcastInterval || "";
            const scalingIntervalFields = `
                <div class="flexrow">
                    <span>Every</span>&nbsp;
                    <input type="text" name="flags.wire.upcastInterval" data-dtype="Number" placeholder="1" value="${interval}" />&nbsp;
                    <span>level(s)</span>
                </div>
            `;
            html.find('select[name="system.scaling.mode"]').parent().append(scalingIntervalFields);
        }

        // Conditions
        await injectConditionList(item, html, '.tab.details', "item");
    });

}

export function setupItemSheetWrappers() {
    libWrapper.register("wire", "game.dnd5e.applications.item.ItemSheet5e.prototype._getSubmitData", onItemSubmit, "MIXED");
}

function onItemSubmit(wrapped, updateData) {
    const submitData = wrapped(updateData);

    // Create the expanded update data object
    const fd = new FormDataExtended(this.form, {editors: this.editors});
    let data = fd.object;
    if ( updateData ) data = mergeObject(data, updateData);
    else data = expandObject(data);

    // Re-handle Damage array
    const damage = data.system?.damage;
    if ( damage ) submitData['flags.wire.damageParts'] = Object.values(damage?.parts || {}).map(d => {
        return {
            halving: d["halving"] || "",
            application: d["application"] || ""
        }
    });

    // Re-handle the variants array
    const variants = data.flags?.wire?.variants;
    if (variants) submitData['flags.wire.variants'] = Object.values(variants);

    const conditions = data.flags?.wire?.conditions;
    if (conditions) submitData['flags.wire.conditions'] = Object.values(conditions);

    return submitData;
}
