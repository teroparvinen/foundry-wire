
export function readyCharacterSheetWrappers() {
    libWrapper.register("wire", "CONFIG.Actor.sheetClasses.character['dnd5e.ActorSheet5eCharacter'].cls.prototype._onItemRoll", onItemRoll, "MIXED");
}

function onItemRoll(wrapped, event) {
    event.preventDefault();
    const itemId = event.currentTarget.closest(".item").dataset.itemId;
    const item = this.actor.items.get(itemId);
    if ( item ) return item.roll({}, event);
}
