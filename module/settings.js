
export function initSettings() {
    game.settings.register(
        "wire",
        "beta-warning-displayed",
        {
            default: false,
            type: Boolean
        }
    );
}