import { Flow } from "../flow.js";
import { fromUuid, i18n, isItemEffect } from "../utils.js";

const conditionList = [
    ["creature-enters-area", "all"],
    ["creature-starts-turn-inside-area", "all"],
    ["creature-ends-turn-inside-area", "all"],
    ["creature-moves-within-area", "all"],
    ["ally-enters-area", "all"],
    ["ally-starts-turn-inside-area", "all"],
    ["ally-ends-turn-inside-area", "all"],
    ["ally-moves-within-area", "all"],
    ["enemy-enters-area", "all"],
    ["enemy-starts-turn-inside-area", "all"],
    ["enemy-ends-turn-inside-area", "all"],
    ["enemy-moves-within-area", "all"],
    ["area-envelops-creature", "all"],
    ["area-envelops-ally", "all"],
    ["area-envelops-enemy", "all"],
    ["area-reveals-creature", "all"],
    ["area-reveals-ally", "all"],
    ["area-reveals-enemy", "all"],
    ["start-of-turn-caster", "effect"],
    ["end-of-turn-caster", "effect"],
    ["start-of-turn-target", "all"],
    ["end-of-turn-target", "all"],
    ["change-of-turn", "effect"],
    ["take-an-action", "all"],
    ["this-attack-hits", "item"],
    ["target-attacks.all", "effect"],
    ["target-attacks.mwak", "effect"],
    ["target-attacks.rwak", "effect"],
    ["target-attacks.msak", "effect"],
    ["target-attacks.rsak", "effect"],
    ["target-hits.all", "effect"],
    ["target-hits.mwak", "effect"],
    ["target-hits.rwak", "effect"],
    ["target-hits.msak", "effect"],
    ["target-hits.rsak", "effect"],
    ["target-is-attacked.all", "effect"],
    ["target-is-attacked.mwak", "effect"],
    ["target-is-attacked.rwak", "effect"],
    ["target-is-attacked.msak", "effect"],
    ["target-is-attacked.rsak", "effect"],
    ["target-is-hit.all", "effect"],
    ["target-is-hit.mwak", "effect"],
    ["target-is-hit.rwak", "effect"],
    ["target-is-hit.msak", "effect"],
    ["target-is-hit.rsak", "effect"],
    ["target-casts-spell", "effect"],
    ["takes-damage", "effect"],
    ["saving-throw-completed", "effect"],
    ["skill-check-completed", "effect"],
    ["ability-check-completed", "effect"],
    ["prepare-skill-check", "all"],
    ["prepare-ability-check", "all"],
    ["prepare-ability-save", "all"],
    ["prepare-attack-roll", "all"],
    ["prepare-damage-roll", "all"],
    ["effect-created", "effect"],
    ["effect-ends", "effect"]
];

const updateList = [
    ["apply-immediate", ["all"]],
    ["apply-delayed", ["all"]],
    ["apply-overtime", ["all"]],
    ["apply-effects-immediate", ["all"]],
    ["apply-effects-delayed", ["all"]],
    ["apply-effects-overtime", ["all"]],
    ["end", ["all"]],
    ["end-on-save", ["all"]],
    ["end-on-check", ["all"]],
]

export async function injectConditionList(object, html, containerSelector, conditionType, submitOnChange) {
    const selected = (value, fieldValue) => { return value === fieldValue ? "selected" : "" };

    let customUpdaters = [];
    try {
        const item = object instanceof CONFIG.Item.documentClass ? object : (isItemEffect(object) ? object.parent : fromUuid(object.origin));
        const flow = new Flow(item, "none");
        flow.evaluate();
        customUpdaters = Object.keys(flow.customUpdaters);
    } catch(error) {
        console.error(error);
    }

    let conditions = object.getFlag("wire", "conditions") || [];
    if (!Array.isArray(conditions)) {
        conditions = [];
        object.setFlag("wire", "conditions", []);
    }
    const makeConditionRow = (condition, i) => {
        const bits = [];
        bits.push(`
            <li class="flexrow condition-part condition" data-condition="${i}">
                <select name="flags.wire.conditions.${i}.condition">
                    <option value=""></option>
        `);
        bits.push(conditionList.filter(c => ["all", conditionType].includes(c[1])).map(c => `
                    <option value="${c[0]}" ${selected(condition.condition, c[0])}>${i18n("wire.item.condition-" + c[0])}</option>`).join(""));
        bits.push(`
                </select>
                <select name="flags.wire.conditions.${i}.update">
                    <option value=""></option>
        `);
        bits.push(updateList.map(u => `
                    <option value="${u[0]}" ${selected(condition.update, u[0])}>${i18n("wire.item.update-" + u[0])}</option>`).join(""));
        bits.push(customUpdaters.map(u => `
                    <option value="${u}" ${selected(condition.update, u)}>${u}</option>`).join(""));
        bits.push(`
                </select>
                <a class="condition-control delete-condition"><i class="fas fa-minus"></i></a>
            </li>
        `);

        return bits.join("");
    };
    const conditionsHtml = conditions?.map((condition, i) => makeConditionRow(condition, i)).join("");

    const fields = `
        <h3 class="form-header">${i18n("wire.item.condition-list-header")}</h3>
        <h4 class="condition-header">
            ${i18n("wire.item.conditions-and-effects")}
            <a class="condition-control add-condition"><i class="fas fa-plus"></i></a>
        </h4>
        <ol class="condition-parts form-group">
            ${conditionsHtml}
        </ol>
    `;
    html.find(containerSelector).append(fields);

    function registerDeleteHandlers(html) {
        html.find('.delete-condition').off('click').click(async (event) => {
            if (submitOnChange) {
                const i = event.target.closest('.condition').dataset.condition;
                const conditions = object.getFlag("wire", "conditions") || [];
                conditions.splice(i, 1);
                await object.setFlag("wire", "conditions", conditions);
            } else {
                event.target.closest('.condition').remove();
            }
        });
    }

    html.find('.add-condition').click(async (event) => {
        if (submitOnChange) {
            const conditions = object.getFlag("wire", "conditions") || [];
            conditions.push({});
            await object.setFlag("wire", "conditions", conditions);
        } else {
            const indices = html.find('.condition-parts li').map((i, el) => el.dataset.condition).get();
            const idx = indices.length ? Math.max(...indices) + 1 : 0;
            html.find('.condition-parts').append(makeConditionRow({}, idx));
            registerDeleteHandlers(html);
        }
    });

    registerDeleteHandlers(html);
}
