
export function readyCharacterSheetWrappers() {
    libWrapper.register("wire", "game.dnd5e.applications.actor.ActorSheet5eCharacter.prototype._onItemUse", onItemUse, "MIXED");

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

function onItemUse(wrapped, event) {
    event.preventDefault();
    const itemId = event.currentTarget.closest(".item").dataset.itemId;
    const item = this.actor.items.get(itemId);
    if ( item ) return item.use({}, { event });
}

function onItemImageRightClick(event) {
    if (event.which === 3) {
        event.preventDefault();
        event.stopPropagation();
        const itemId = event.currentTarget.closest(".item").dataset.itemId;
        const item = this.items.get(itemId);
        if ( item ) return item.use({}, { event });
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
