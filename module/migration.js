import { i18n } from "./utils.js";

export async function checkMigration() {
    const currentVersion = game.modules.get("wire").version;
    const migratedVersion = game.settings.get("wire", "migratedVersion") || "0";

    if (foundry.utils.isNewerVersion("0.11.0", migratedVersion)) {
        // Migrate from item macro to wire script
        const worldItems = game.items;
        const actorItems = [...game.actors].flatMap(actor => [...actor.items]);
        const sceneItems = [...game.scenes].flatMap(s => [...s.tokens]).filter(t => !t.isLinked).map(t => t.actor).flatMap(a => [...a.items]);

        const packs = [...game.packs].filter(p => {
            const isWorldPack = !p.locked && p.metadata.packageType === "world";
            const isUnlockedWirePack = !p.locked && p.metadata.flags.wireImport

            return isWorldPack || isUnlockedWirePack;
        })
        const packItemArrays = await Promise.all(packs.filter(p => p.documentName === "Item").map(p => p.getDocuments()));
        const packItems = packItemArrays.flat()
        const packActorArrays = await Promise.all(packs.filter(p => p.documentName === "Actor").map(p => p.getDocuments()));
        const packActors = packActorArrays.flat();
        const packActorItems = packActors.flatMap(actor => [...actor.items]);

        const items = [...worldItems, ...actorItems, ...sceneItems, ...packItems, ...packActorItems];
        let count = 0;
        for (let item of items) {
            const itemMacroData = item.flags.itemacro?.macro;
            const wireScript = item.flags.wire?.script?.trim();
            if (itemMacroData && !wireScript) {
                const itemMacroCommand = itemMacroData?.command?.trim() || itemMacroData?.data?.command?.trim();
                if (itemMacroCommand) {
                    const details = [item.name];
                    const updateData = {
                        "flags.itemacro.macro.command": "",
                        "flags.wire.script": itemMacroCommand
                    };

                    const pack = game.packs.get(item.pack);
                    const module = game.modules.get(pack?.metadata.packageName)
                    if (pack) {
                        details.push(`Pack: ${pack.metadata.label}`);
                    }
                    if (pack && module && pack.metadata.flags.wireImport && foundry.utils.isNewerVersion(module.version, item.flags.wire.compendiumVersion)) {
                        updateData["flags.wire.compendiumVersion"] = module.version;
                        details.push(`Compendium version ${module.version}`);
                    }

                    console.log(`[MIGRATION] Item Macro script to WIRE script\n${details.join(" | ")}`);
                    await item.update(updateData);
                    count++;
                }
            }
        }

        ui.notifications.info(i18n("wire.migration.itemacro-to-script", { count }));
    }

    game.settings.set("wire", "migratedVersion", currentVersion);
}
