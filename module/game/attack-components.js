import { makeModifier } from "../utils.js";

export function getDisplayableAttackComponents(item, short = false) {
    const components = getAttackComponents(item);
    if (components) {
        return Object.entries(components).map(([part, value]) => {
            return {
                i18nKey: `wire.roll-component.${part}${short ? "-short" : ""}`,
                value: makeModifier(value)
            }
        });
    }
    return [];
}

export function getSituationalAttackComponents(config, deterministicOnly = false) {
    if (config.attack?.bonus) {
        const bonus = config.attack.bonus;
        if (!deterministicOnly || new Roll(bonus).isDeterministic) {
            return [{
                i18nKey: "wire.roll-component.situational",
                value: makeModifier(bonus)
            }]
        }
    }
    return [];
}

export function getAttackComponents(item) {
    const itemData = item.system;
    if (!item.hasAttack || !itemData) return;
    const rollData = item.getRollData();

    // Define Roll bonuses
    const parts = {};

    // Include the item's innate attack bonus as the initial value and label
    if (itemData.attackBonus && (parseInt(itemData.attackBonus) !== 0)) {
        parts.item = itemData.attackBonus;
    }

    // Take no further action for un-owned items
    if (!item.isOwned) return parts;

    // Ability score modifier
    parts.ability = rollData.mod;

    // Add proficiency bonus if an explicit proficiency flag is present or for non-item features
    if (!["weapon", "consumable"].includes(item.type) || itemData.proficient) {
        if (item.system.prof?.hasProficiency) {
            parts.prof = item.system.prof.term;
        }
    }

    // Actor-level global bonus to attack rolls
    const actorBonus = item.actor.system.bonuses?.[itemData.actionType] || {};
    if (actorBonus.attack) {
        parts.bonus = actorBonus.attack;
    }

    // One-time bonus provided by consumed ammunition
    if ((itemData.consume?.type === "ammo") && item.actor.items) {
        const ammoItemData = item.actor.items.get(itemData.consume.target);

        if (ammoItemData) {
            const ammoItemQuantity = ammoItemData.system.quantity;
            const ammoCanBeConsumed = ammoItemQuantity && (ammoItemQuantity - (itemData.consume.amount ?? 0) >= 0);
            const ammoItemAttackBonus = ammoItemData.system.attackBonus;
            const ammoIsTypeConsumable = (ammoItemData.type === "consumable") && (ammoItemData.system.consumableType === "ammo");
            if (ammoCanBeConsumed && ammoItemAttackBonus && ammoIsTypeConsumable) {
                parts.ammo = ammoItemAttackBonus;
            }
        }
    }

    return parts;
}
