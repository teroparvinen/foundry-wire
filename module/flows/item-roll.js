import { friendlyTarget, nonAttack, secondary } from "./common.js"

export function itemRollFlow() {
    const immediate = this.pick(
        this.isConditionTriggered(
            secondary.apply(this)
        ),
        this.sequence(
            this.hasDuration(
                this.hasConcentration(
                    this.applyConcentration()
                ),
                this.hasAreaTarget(
                    this.applyDurationEffect()
                )
            ),
            this.pick(
                this.isTokenTargetable(
                    this.sequence(
                        this.applySelectedTargets(),
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
                ),
                this.hasAreaTarget(
                    this.hasDamageOrEffects(
                        this.confirmTargets(
                            nonAttack.apply(this)
                        )
                    )
                ),
                this.isSelfTarget(
                    friendlyTarget.apply(this)
                )
            )
        )
    )

    return this.pick(
        this.isImmediateApplication(
            immediate
        ),
        this.isDelayedApplication(
            secondary.apply(this)
        ),
        this.isOverTimeApplication(
            secondary.apply(this)
        )
    )
}
