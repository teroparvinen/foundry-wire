
// Roll helpers
Math.eq = (a, b) => (a === b ? 1 : 0);
Math.ne = (a, b) => (a !== b ? 1 : 0);
Math.not = (a) => (a ? 0 : 1);
Math.gt = (a, b) => (a > b ? 1 : 0);
Math.gte = (a, b) => (a >= b ? 1 : 0);
Math.lt = (a, b) => (a < b ? 1 : 0);
Math.lte = (a, b) => (a <= b ? 1 : 0);
Math.and = (...args) => (args.every(a => a) ? 1 : 0);
Math.or = (...args) => (args.some(a => a) ? 1 : 0);
Math.pick = (cond, then, otherwise) => (cond ? (then === undefined ? 1 : then) : (otherwise === undefined ? 0 : otherwise));
Math.unless = (cond, then, otherwise) => (!cond ? (then === undefined ? 1 : then) : (otherwise === undefined ? 0 : otherwise));
Math.includes = function(...args) {
    const v = args.pop()
    return args.includes(v) ? 1 : 0;
}

export function setupLogicRolls() {
    libWrapper.ignore_conflicts("wire", "dae", "Roll.replaceFormulaData");
    libWrapper.register("wire", "Roll.replaceFormulaData", replaceFormulaData, "OVERRIDE");
}

function formatReplacementResult(value) {
    if (Array.isArray(value)) {
        return value.length ? value.map(v => formatReplacementResult(v)).join() : "undefined";
    } else {
        const str = String(value).trim();
        const isQuotable = str.match(/^[a-z][\w\.-]*$/i);
        return isQuotable ? `"${str}"` : str;
    }
}

function replaceFormulaData(formula, data, {missing, warn=false}={}) {
    let dataRgx = new RegExp(/@([a-z.0-9_\-]+)/gi);
    return formula.replace(dataRgx, (match, term) => {
        let value = foundry.utils.getProperty(data, term);
        if ( value == null ) {
            if ( warn && ui.notifications ) ui.notifications.warn(game.i18n.format("DICE.WarnMissingData", {match}));
            return (missing !== undefined) ? String(missing) : match;
        }
        const res = formatReplacementResult(value);
        return res;
    });
}
