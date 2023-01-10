import { Flow } from "./flow.js";
import { ApplyEffectsUpdater } from "./updaters/apply-effects.js";
import { ApplySecondaryUpdater } from "./updaters/apply-secondary.js";
import { EndOnSaveUpdater } from "./updaters/end-on-save.js";
import { EndUpdater } from "./updaters/end.js";
import { RunCustomUpdater } from "./updaters/run-custom.js";
import { fromUuid, isCastersTurn } from "./utils.js";

export function makeUpdater(condition, effect, item, { externalTargetActor = null, details = null, activationConfig = null } = {}) {
    switch (condition.update) {
    case "apply-immediate":
    case "apply-delayed":
    case "apply-overtime":
        return new ApplySecondaryUpdater(condition, effect, item, externalTargetActor, details, activationConfig);
    case "apply-effects-immediate":
    case "apply-effects-delayed":
    case "apply-effects-overtime":
        return new ApplyEffectsUpdater(condition, effect, item, externalTargetActor, details, activationConfig);
    case "end":
        return new EndUpdater(condition, effect, item, externalTargetActor, details, activationConfig);
    case "end-on-save":
    case "end-on-check":
        return new EndOnSaveUpdater(condition, effect, item, externalTargetActor, details, activationConfig);
    default:
        const flow = new Flow(item, "none");
        flow.evaluate();
        const updater = flow.customUpdaters[condition.update]
        if (updater) {
            return new RunCustomUpdater(condition, effect, item, externalTargetActor, details, activationConfig, updater);
        } else {
            console.warn("MISSING UPDATER", condition.update);
        }
    }
}

export function determineUpdateTargets(item, effect, condition, externalTargetActor) {
    const getOriginalTargets = () => {
        if (effect.flags.wire?.isMasterEffect) {
            return effect.flags.wire?.childEffectUuids?.map(uuid => fromUuid(uuid)).map(e => e?.parent).filter(a => a);
        } else {
            return [effect.parent];
        }
    }

    switch (condition.condition) {
        case "creature-enters-area":
        case "creature-starts-turn-inside-area":
        case "creature-ends-turn-inside-area":
        case "creature-moves-within-area":
        case "ally-enters-area":
        case "ally-starts-turn-inside-area":
        case "ally-ends-turn-inside-area":
        case "ally-moves-within-area":
        case "enemy-enters-area":
        case "enemy-starts-turn-inside-area":
        case "enemy-ends-turn-inside-area":
        case "enemy-moves-within-area":
        case "area-envelops-creature":
        case "area-envelops-ally":
        case "area-envelops-enemy":
        case "area-reveals-creature":
        case "area-reveals-ally":
        case "area-reveals-enemy":
            if (!externalTargetActor) {
                console.warn("Area conditions need an external actor target. None given.");
                return [];
            } else {
                return [externalTargetActor]
            }
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
        case "takes-damage":
        case "saving-throw-completed":
        case "effect-created":
        case "effect-ends":
            return [effect.parent];
        case "take-an-action":
            if (isCastersTurn(item)) {
                return getOriginalTargets();
            } else {
                return [effect.parent];
            }
        case "this-attack-hits":
            return [externalTargetActor];
    }
}