import { Activation } from "./activation.js";

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

    game.keybindings.register("wire", "confirm-attack-hit", {
        name: "wire.keybindings.confirm-attack-hit",
        hint: "wire.keybindings.confirm-attack-hit-hint",
        editable: [],
        onDown: (ctx) => {
            if (game.user.isGM) {
                applyAttackResult(true);
            }
        },
        restricted: true
    });

    game.keybindings.register("wire", "confirm-attack-miss", {
        name: "wire.keybindings.confirm-attack-miss",
        hint: "wire.keybindings.confirm-attack-miss-hint",
        editable: [],
        onDown: (ctx) => {
            if (game.user.isGM) {
                applyAttackResult(false);
            }
        },
        restricted: true
    });

    game.keybindings.register("wire", "confirm-attack-auto", {
        name: "wire.keybindings.confirm-attack-auto",
        hint: "wire.keybindings.confirm-attack-auto-hint",
        editable: [],
        onDown: (ctx) => {
            if (game.user.isGM) {
                applyAttackResult("auto");
            }
        },
        restricted: true
    });

}

function applyAttackResult(result) {
    const messages = game.messages.filter(m => m.flags.wire?.activation?.state === "waiting-for-attack-result" && m.flags.wire?.originatorUserId == game.user.id);
    if (messages.length) {
        const message = messages[messages.length - 1];
        const activation = new Activation(message);

        const roll = activation.attackRoll?.total;
        const ac =  activation.attackTarget?.actor.system.attributes.ac.value;

        activation.applyAttackResult(result === "auto" ? roll >= ac : result);
    }
}
