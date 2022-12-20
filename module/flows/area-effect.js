import { nonAttack } from "./common.js";

export function areaEffectFlow({ removeSelfTarget = false }) {
    const application = this.confirmTargets(
        this.applySelectedTargets(
            nonAttack.apply(this)
        )
    );

    return this.hasAreaTarget(
        this.hasDamageOrEffects(
            this.placeTemplate(
                removeSelfTarget ? this.removeSelfTarget(application) : application
            )
        )
    )
}
