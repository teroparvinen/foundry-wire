
export function initSettings() {
    game.settings.register(
        "wire",
        "beta-warning-displayed",
        {
            default: false,
            type: Boolean
        }
    );

    game.settings.register(
        "wire",
        "wounded-threshold",
        {
            name: "wire.settings.wounded-threshold",
            hint: "wire.settings.wounded-threshold-hint",
            scope: "world",
            config: true,
            type: Number,
            range: {
                min: 1,
                max: 99,
                step: 1
            },
            default: 50
        }
    );

    game.settings.register(
        "wire",
        "wounded-overlay",
        {
            name: "wire.settings.wounded-overlay",
            scope: "world",
            config: true,
            type: Boolean,
            default: false
        }
    );

    game.settings.register(
        "wire",
        "round-change-notifications",
        {
            name: "wire.settings.round-change-notifications",
            scope: "world",
            config: true,
            type: Boolean,
            default: true
        }
    );

    game.settings.register(
        "wire",
        "turn-change-notifications",
        {
            name: "wire.settings.turn-change-notifications",
            scope: "world",
            config: true,
            type: Boolean,
            default: true
        }
    );

    game.settings.register(
        "wire",
        "reveal-npc-turn-change",
        {
            name: "wire.settings.reveal-npc-turn-change",
            hint: "wire.settings.reveal-npc-turn-change-hint",
            scope: "world",
            config: true,
            type: Boolean,
            default: false
        }
    );

    game.settings.register(
        "wire",
        "reveal-save-dc",
        {
            name: "wire.settings.reveal-save-dc",
            hint: "wire.settings.reveal-save-dc-hint",
            scope: "world",
            config: true,
            type: Boolean,
            default: false
        }
    );

    game.settings.register(
        "wire",
        "hide-npc-save-results",
        {
            name: "wire.settings.hide-npc-save-results",
            hint: "wire.settings.hide-npc-save-results-hint",
            scope: "world",
            config: true,
            type: Boolean,
            default: false
        }
    );

    game.settings.register(
        "wire",
        "damage-roll-confirms-hit",
        {
            name: "wire.settings.damage-roll-confirms-hit",
            hint: "wire.settings.damage-roll-confirms-hit-hint",
            scope: "world",
            config: true,
            type: Boolean,
            default: false
        }
    );

    game.settings.register(
        "wire",
        "change-turn-focus-npc",
        {
            name: "wire.settings.change-turn-focus-npc",
            scope: "world",
            config: true,
            type: Boolean,
            default: true
        }
    );

    game.settings.register(
        "wire",
        "change-turn-control-npc",
        {
            name: "wire.settings.change-turn-control-npc",
            scope: "world",
            config: true,
            type: Boolean,
            default: true
        }
    );

    game.settings.register(
        "wire",
        "auto-drop-concentration",
        {
            name: "wire.settings.auto-drop-concentration",
            hint: "wire.settings.auto-drop-concentration-hint",
            scope: "world",
            config: true,
            type: Boolean,
            default: false
        }
    );

    game.settings.register(
        "wire",
        "track-bonus-actions",
        {
            name: "wire.settings.track-bonus-actions",
            hint: "wire.settings.track-bonus-actions-hint",
            scope: "world",
            config: true,
            type: Boolean,
            default: false
        }
    );

    game.settings.register(
        "wire",
        "track-reactions",
        {
            name: "wire.settings.track-reactions",
            hint: "wire.settings.track-reactions-hint",
            scope: "world",
            config: true,
            type: Boolean,
            default: false
        }
    );

    game.settings.register(
        "wire",
        "out-of-turn-reactions",
        {
            name: "wire.settings.out-of-turn-reactions",
            hint: "wire.settings.out-of-turn-reactions-hint",
            scope: "world",
            config: true,
            type: Boolean,
            default: false
        }
    );
}