
export function applySecondaryFlow() {
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
            this.performSaveDamageRoll(
                this.sequence(
                    this.applyDamage(),
                    this.applyEffects()
                )
            )
        ),
        this.applyEffects()
    )
}
