import { ApplySecondaryUpdater } from "./updaters/apply-secondary.js";
import { EndOnSaveUpdater } from "./updaters/end-on-save.js";
import { EndUpdater } from "./updaters/end.js";
import { fromUuid, isCastersTurn } from "./utils.js";

export function makeUpdater(condition, effect, item, externalTargetActor = null) {
    switch (condition.update) {
    case "apply-delayed":
    case "apply-overtime":
        return new ApplySecondaryUpdater(condition, effect, item, externalTargetActor);
        break;
    case "end":
        return new EndUpdater(condition, effect, item, externalTargetActor);
        break;
    case "end-on-save":
        return new EndOnSaveUpdater(condition, effect, item, externalTargetActor);
        break;
    default:
        console.warn("MISSING UPDATER", update.condition);
    }
}

export function determineUpdateTargetUuids(item, effect, condition, externalTargetActor) {
    const getOriginalTargets = () => {
        if (effect.data.flags.wire?.isMasterEffect) {
            return effect.data.flags.wire?.childEffectUuids?.map(uuid => fromUuid(uuid)).map(e => e?.parent.uuid).filter(uuid => uuid);
        } else {
            return [effect.parent.uuid];
        }
    }

    switch (condition.condition) {
        case "creature-enters-area":
        case "creature-starts-turn-inside-area":
        case "creature-ends-turn-inside-area":
        case "ally-enters-area":
        case "ally-starts-turn-inside-area":
        case "ally-ends-turn-inside-area":
        case "enemy-enters-area":
        case "enemy-starts-turn-inside-area":
        case "enemy-ends-turn-inside-area":
            if (!externalTargetActor) {
                console.warn("Area conditions need an external actor target. None given.");
                return [];
            } else {
                return [externalTargetActor.uuid]
            }
        case "area-placed-over":
            console.warn("Not implemented");
            break;
        case "start-of-turn-caster":
        case "end-of-turn-caster":
            return getOriginalTargets();
        case "start-of-turn-target":
        case "end-of-turn-target":
        case "target-attacks.all":
        case "target-attacks.mwak":
        case "target-attacks.rwak":
        case "target-attacks.msak":
        case "target-attacks.rsak":
        case "target-hits.all":
        case "target-hits.mwak":
        case "target-hits.rwak":
        case "target-hits.msak":
        case "target-hits.rsak":
        case "target-is-hit.all":
        case "target-is-hit.mwak":
        case "target-is-hit.rwak":
        case "target-is-hit.msak":
        case "target-is-hit.rsak":
            return [effect.parent.uuid];
        case "take-an-action":
            if (isCastersTurn(item)) {
                return getOriginalTargets();
            } else {
                return [effect.parent.uuid];
            }
        }
}