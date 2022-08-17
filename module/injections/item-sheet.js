import { i18n } from "../utils.js";
import { injectConditionList } from "./condition-list.js";

export function initItemSheetHooks() {
    Hooks.on("renderItemSheet5e", async (app, html, data) => {
        const selected = (value, fieldValue) => { return value === fieldValue ? "selected" : "" };

        const parts = app.object.data.data.damage.parts;
        
        html.find('.damage-part').each(function() {
            const i = this.dataset.damagePart;
            const halving = parts[i]["halving"] || parts[i][2];
            const application = parts[i]["application"] || parts[i][3];
            const fields = `
                <select name="data.damage.parts.${i}.halving">
                    <option value="none">${i18n("wire.item.damage-none")}</option>
                    <option value="half" ${selected(halving, "half")}>${i18n("wire.item.damage-half")}</option>
                    <option value="full" ${selected(halving, "full")}>${i18n("wire.item.damage-full")}</option>
                </select>
                <select name="data.damage.parts.${i}.application">
                    <option value="immediate">${i18n("wire.item.application-immediate")}</option>
                    <option value="delayed" ${selected(application, "delayed")}>${i18n("wire.item.application-delayed")}</option>
                    <option value="overtime" ${selected(application, "overtime")}>${i18n("wire.item.application-overtime")}</option>
                </select>
            `;
            $(this).find('.delete-damage').before(fields);
        });

        html.find('.damage-parts option[value="temphp"]').each(function() {
            if ($(this).text() === "Healing (Temporary)") $(this).text("Healing (Temp)");
        });

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
    if ( damage ) submitData['data.damage.parts'] = Object.values(damage?.parts || {}).map(d => {
        return {
            0: d[0] || "",
            1: d[1] || "",
            halving: d["halving"] || "",
            application: d["application"] || ""
        }
    });

    const conditions = data.flags?.wire?.conditions;
    if (conditions) submitData['flags.wire.conditions'] = Object.values(conditions);

    return submitData;
}
