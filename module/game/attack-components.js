
function makeModifier(value) {
    if (value && !isNaN(+value) && value > 0) {
        return `+${value}`;
    }
    return value;
}

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
}

export function getAttackComponents(item) {
    const itemData = item.data.data;
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
    if (!["weapon", "consumable"].includes(item.data.type) || itemData.proficient) {
        if (item.data.data.prof?.hasProficiency) {
            parts.prof = item.data.data.prof.term;
        }
    }

    // Actor-level global bonus to attack rolls
    const actorBonus = item.actor.data.data.bonuses?.[itemData.actionType] || {};
    if (actorBonus.attack) {
        parts.bonus = actorBonus.attack;
    }

    // One-time bonus provided by consumed ammunition
    if ((itemData.consume?.type === "ammo") && item.actor.items) {
        const ammoItemData = item.actor.items.get(itemData.consume.target)?.data;

        if (ammoItemData) {
            const ammoItemQuantity = ammoItemData.data.quantity;
            const ammoCanBeConsumed = ammoItemQuantity && (ammoItemQuantity - (itemData.consume.amount ?? 0) >= 0);
            const ammoItemAttackBonus = ammoItemData.data.attackBonus;
            const ammoIsTypeConsumable = (ammoItemData.type === "consumable") && (ammoItemData.data.consumableType === "ammo");
            if (ammoCanBeConsumed && ammoItemAttackBonus && ammoIsTypeConsumable) {
                parts.ammo = ammoItemAttackBonus;
            }
        }
    }

    return parts;
}
