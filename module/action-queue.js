
let semaphore;

export function setupActionQueue() {
    if (game.modules.get("dae")?.active) {
        if (DAE.actionQueue) {
            semaphore = DAE.actionQueue;
        } else {
            Hooks.once("DAE.setupComplete", () => {
                semaphore = DAE.actionQueue;
            });
        }
    } else {
        semaphore = new semaphore();
    }
}

export async function runInQueue(fn, ...args) {
    if (!semaphore) {
        console.warn("Trying to run with an uninitialized action queue!");
        return;
    }

    const result = await semaphore.add(fn, ...args);
    return result;
}
