
export function readyCharacterSheetWrappers() {
    libWrapper.register("wire", "CONFIG.Actor.sheetClasses.character['dnd5e.ActorSheet5eCharacter'].cls.prototype._onItemRoll", onItemRoll, "MIXED");

    Hooks.on("renderTidy5eSheet", (app, html, data) => {
        let favContent = html.find('.favorites-target');

        const observer = new MutationObserver(() => {
            favContent.find('.rollable .item-image')
                .off("mousedown")
                .mousedown(onItemImageRightClick.bind(app.object))
                .hover(onItemImageHoverIn.bind(app.object), onItemImageHoverOut.bind(app.object))
            observer.disconnect();        
        });
        observer.observe(favContent[0], { childList: true });
    });

    Hooks.on("renderActorSheet", (app, html, data) => {
        html.find('.rollable .item-image')
            .mousedown(onItemImageRightClick.bind(app.object))
            .hover(onItemImageHoverIn.bind(app.object), onItemImageHoverOut.bind(app.object));
    });
}

function onItemRoll(wrapped, event) {
    event.preventDefault();
    const itemId = event.currentTarget.closest(".item").dataset.itemId;
    const item = this.actor.items.get(itemId);
    if ( item ) return item.roll({}, event);
}

function onItemImageRightClick(event) {
    if (event.which === 3) {
        event.preventDefault();
        event.stopPropagation();
        const itemId = event.currentTarget.closest(".item").dataset.itemId;
        const item = this.items.get(itemId);
        if ( item ) return item.roll({}, event);
    }
}

function onItemImageHoverIn(event) {
    const itemId = event.currentTarget.closest(".item").dataset.itemId;
    const item = this.items.get(itemId);
    Hooks.callAll("actorItemHoverIn", item, $(event.currentTarget));
}

function onItemImageHoverOut(event) {
    const itemId = event.currentTarget.closest(".item").dataset.itemId;
    const item = this.items.get(itemId);
    Hooks.callAll("actorItemHoverOut", item, $(event.currentTarget));
}
