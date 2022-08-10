import { i18n } from "../utils.js";
import { injectConditionList } from "./condition-list.js";

export function initActiveEffectSheetHooks() {
    Hooks.on("renderActiveEffectConfig", async (app, html, data) => {
        const effect = app.object;
        const applyOnSaveOrMiss = effect.getFlag("wire", "applyOnSaveOrMiss");
        const applicationType = effect.getFlag("wire", "applicationType");
        const checked = (value) => { return value ? "checked" : "" };
        const selected = (value, fieldValue) => { return value === fieldValue ? "selected" : "" };
        const fields = `
            <div class="form-group">
                <label>${i18n("wire.active-effect.apply-on-save-or-miss")}</label>
                <input type="checkbox" name="flags.wire.applyOnSaveOrMiss" ${checked(applyOnSaveOrMiss)}>
            </div>
            <div class="form-group">
                <label>${i18n("wire.active-effect.application-phase")}</label>
                <select name="flags.wire.applicationType">
                    <option value="immediate">${i18n("wire.item.application-immediate")}</option>
                    <option value="delayed" ${selected(applicationType, "delayed")}>${i18n("wire.item.application-delayed")}</option>
                    <option value="overtime" ${selected(applicationType, "overtime")}>${i18n("wire.item.application-overtime")}</option>
                </select>
                <div class="hint">${i18n("wire.active-effect.application-phase-hint")}</div>
            </div>
        `;
        html.find('section[data-tab="details"] .form-group').last().after(fields);

        await injectConditionList(app.object, html, 'section[data-tab="details"]', "effect");
    });
}

export function setupActiveEffectSheetWrappers() {
    if (typeof DAE !== "undefined") {
        libWrapper.register("wire", "DAE.DAEActiveEffectConfig.prototype._getSubmitData", onItemSubmit, "MIXED");
    } else {
        libWrapper.register("wire", "ActiveEffectConfig.prototype._getSubmitData", onItemSubmit, "MIXED");
    }
}

function onItemSubmit(wrapped, updateData) {
    const submitData = wrapped(updateData);

    // Create the expanded update data object
    const fd = new FormDataExtended(this.form, {editors: this.editors});
    let data = fd.toObject();
    if ( updateData ) data = mergeObject(data, updateData);
    else data = expandObject(data);

    const conditions = data.flags?.wire?.conditions;
    if (conditions) submitData['flags.wire.conditions'] = Object.values(conditions);

    return submitData;
}

