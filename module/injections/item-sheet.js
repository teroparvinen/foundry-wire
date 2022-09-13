import { i18n } from "../utils.js";
import { injectConditionList } from "./condition-list.js";

export function initItemSheetHooks() {
    Hooks.on("renderItemSheet5e", async (app, html, data) => {
        const disabled = app.isEditable ? "" : "disabled";

        const selected = (value, fieldValue) => { return value === fieldValue ? "selected" : "" };

        // Allow formula for target
        const stockTargetValue = foundry.utils.getProperty(app.object.data, "data.target.value");
        const targetValue = foundry.utils.getProperty(app.object.data, "flags.wire.override.target.value") || stockTargetValue;
        html.find('input[name="data.target.value"]')
            .removeAttr("data-dtype")
            .attr("name", "flags.wire.override.target.value")
            .val(targetValue);

        // Damage parts
        const parts = app.object.data.data.damage?.parts || [];
        const wireParts = app.object.data.flags.wire?.damageParts || [];
        
        html.find('.damage-part').each(function() {
            const i = this.dataset.damagePart;
            const halving = wireParts[i]?.halving || parts[i]["halving"];
            const application = wireParts[i]?.application || parts[i]["application"];
            const fields = `
                <select name="data.damage.parts.${i}.halving" ${disabled}>
                    <option value="none">${i18n("wire.item.damage-none")}</option>
                    <option value="half" ${selected(halving, "half")}>${i18n("wire.item.damage-half")}</option>
                    <option value="full" ${selected(halving, "full")}>${i18n("wire.item.damage-full")}</option>
                </select>
                <select name="data.damage.parts.${i}.application" ${disabled}>
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
        const checkedAbility = app.object.data.flags.wire?.checkedAbility;
        const abilityOptions = Object.entries(CONFIG.DND5E.abilities).map(a => `<option value="${a[0]}" ${selected(checkedAbility, a[0])}>${a[1]}</option>`)
        html.find('.damage-parts').nextAll('.input-select').first().after(`
            <div class="form-group input-select">
                <label>${i18n("wire.ui.ability-check")}</label>
                <div class="form-fields">
                    <select name="flags.wire.checkedAbility" ${disabled}>
                        <option>${i18n("wire.ui.use-save-for-check")}</option>
                        ${abilityOptions}
                    </select>
                    <div style="flex: 4"></div>
                </div>
            </div>
        `);

        // Spell scaling interval
        if (app.object.data.data.scaling?.mode === "level") {
            const interval = app.object.data.flags.wire?.upcastInterval || "";
            const scalingIntervalFields = `
                <div class="flexrow">
                    <span>Every</span>&nbsp;
                    <input type="text" name="flags.wire.upcastInterval" data-dtype="Number" placeholder="1" value="${interval}" />&nbsp;
                    <span>level(s)</span>
                </div>
            `;
            html.find('select[name="data.scaling.mode"]').parent().append(scalingIntervalFields);
        }

        // Conditions
        await injectConditionList(app.object, html, '.tab.details', "item");
    });

}

export function setupItemSheetWrappers() {
    libWrapper.register("wire", "game.dnd5e.applications.ItemSheet5e.prototype._getSubmitData", onItemSubmit, "MIXED");
}

function onItemSubmit(wrapped, updateData) {
    const submitData = wrapped(updateData);

    // Create the expanded update data object
    const fd = new FormDataExtended(this.form, {editors: this.editors});
    let data = fd.toObject();
    if ( updateData ) data = mergeObject(data, updateData);
    else data = expandObject(data);

    // Re-handle Damage array
    const damage = data.data?.damage;
    if ( damage ) submitData['flags.wire.damageParts'] = Object.values(damage?.parts || {}).map(d => {
        return {
            halving: d["halving"] || "",
            application: d["application"] || ""
        }
    });

    const conditions = data.flags?.wire?.conditions;
    if (conditions) submitData['flags.wire.conditions'] = Object.values(conditions);

    return submitData;
}
