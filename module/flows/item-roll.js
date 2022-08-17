
export function itemRollFlow() {
    const friendlyTarget = this.applyDefaultTargetsAsEffective(
        this.sequence(
            this.performSaveDamageRoll(
                this.applyDamage()
            ),
            this.applyEffects()
        )
    )

    const nonAttack = this.pick(
        this.isSave(
            this.performSavingThrow(
                this.hasDamage(
                    this.performSaveDamageRoll(
                        this.sequence(
                            this.applyDamage(),
                            this.applyEffects()
                        )
                    )
                ),
                this.applyEffects()
            )
        ),
        this.otherwise(
            friendlyTarget
        )
    )
    
    const immediate = this.sequence(
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
                                this.sequence(
                                    this.hasDamage(
                                        this.performAttackDamageRoll(
                                            this.applyDamage(
                                                this.attackCompleted()
                                            )
                                        )
                                    ),
                                    this.applyEffects(
                                        this.attackCompleted()
                                    )
                                )
                            )
                        ),
                        this.otherwise(
                            nonAttack
                        )
                    )
                )
            ),
            this.hasAreaTarget(
                this.hasDamageOrEffects(
                    this.confirmTargets(
                        nonAttack
                    )
                )
            ),
            this.isSelfTarget(
                friendlyTarget
            )
        )
    )

    const secondary = this.pick(
        this.hasSaveableApplications(
            this.performSavingThrow(
                this.hasDamage(
                    this.performSaveDamageRoll(
                        this.sequence(
                            this.applyDamage(),
                            this.applyEffects()
                        )
                    )
                ),
                this.applyEffects()
            )
        ),
        this.hasDamage(
            this.performSaveDamageRoll(
                this.sequence(
                    this.applyDamage(),
                    this.applyEffects()
                )
            )
        ),
        this.applyEffects()
    )

    return this.pick(
        this.isImmediateApplication(
            immediate
        ),
        this.isDelayedApplication(
            secondary
        ),
        this.isOverTimeApplication(
            secondary
        )
    )
}
