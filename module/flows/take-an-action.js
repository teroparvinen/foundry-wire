
export function takeAnActionFlow() {
    return this.applyDefaultTargets(
        this.triggerAction()
    );
}