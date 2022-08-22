
export function setupKeybindings() {
    game.keybindings.register("wire", "next-turn", {
        name: "wire.keybindings.next-turn",
        editable: [
            { key: "KeyN", modifiers: []}
        ],
        onDown: (ctx) => {
            if (game.user.isGM) {
                game.combat?.nextTurn();
            }
        },
        restricted: true
    });

    game.keybindings.register("wire", "previous-turn", {
        name: "wire.keybindings.previous-turn",
        editable: [
            { key: "KeyN", modifiers: [KeyboardManager.MODIFIER_KEYS.SHIFT]}
        ],
        onDown: (ctx) => {
            if (game.user.isGM) {
                game.combat?.previousTurn();
            }
        },
        restricted: true
    });

}
