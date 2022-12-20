import { nonAttack } from "./common.js";

export function singleTargetFlow() {
    return this.sequence(
        this.applySelectedTargets(),
        this.pick(
            this.isAttack(
                this.performAttackRoll(
                    this.hasDamage(
                        this.performAttackDamageRoll(
                            this.applyDamage(
                                this.applyEffects(
                                    this.attackCompleted()
                                )
                            )
                        )
                    ),
                    this.applyEffects(
                        this.attackCompleted()
                    )
                )
            ),
            this.otherwise(
                nonAttack.apply(this)
            )
        )
    )
}