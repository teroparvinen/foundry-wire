import { nonAttack } from "./common.js";

export function singleTargetFlow({ skipTargeting = false } = {}) {
    return this.sequence(
        !skipTargeting && this.applySelectedTargets(),
        this.pick(
            this.isAttack(
                this.performAttackRoll(
                    this.hasDamage(
                        this.performAttackDamageRoll(
                            this.applyDamage(
                                this.applyEffects()
                            )
                        )
                    ),
                    this.applyEffects()
                )
            ),
            this.otherwise(
                nonAttack.apply(this)
            )
        )
    )
}