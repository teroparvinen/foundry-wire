export function friendlyTarget() {
    return this.applyDefaultTargetsAsEffective(
        this.sequence(
            this.performSaveDamageRoll(
                this.applyDamage()
            ),
            this.applyEffects()
        )
    )
}

export function nonAttack() {
    return this.pick(
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
            friendlyTarget.apply(this)
        )
    )
}

export function secondary() {
    return this.pick(
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
            this.applyDefaultTargetsAsEffective(
                this.performSaveDamageRoll(
                    this.sequence(
                        this.applyDamage(),
                        this.applyEffects()
                    )
                )
            )
        ),
        this.applyEffects()
    )
}