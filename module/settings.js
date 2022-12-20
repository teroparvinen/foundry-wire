
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
}