
export function initArbronSummonerHooks() {
    Hooks.on("arbron.preGetSummonsChanges", (item, updates, usage) => {
        const rollData = updates.actor.flags["arbron-summoner"].summoner.data;
        const activationConfig = usage.options.activationConfig;
        rollData.config = activationConfig;
        foundry.utils.setProperty(rollData, "item.level", activationConfig.spellLevel);
    });
}
