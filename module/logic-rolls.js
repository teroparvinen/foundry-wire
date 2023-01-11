
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
Math.substring = function(a, b) {
    const al = a.toLowerCase();
    const bl = b.toLowerCase();
    return al.includes(bl) ? 1 : 0;
}

export function setupLogicRolls() {
    libWrapper.ignore_conflicts("wire", "dae", "Roll.replaceFormulaData");
    libWrapper.register("wire", "Roll.replaceFormulaData", replaceFormulaData, "OVERRIDE");
    libWrapper.register("wire", "Roll.safeEval", safeEval, "OVERRIDE");
    libWrapper.register("wire", "Roll.prototype._evaluateTotal", evaluateTotal, "OVERRIDE");
    libWrapper.register("wire", "StringTerm.prototype.evaluate", stringTermEvaluate, "OVERRIDE");
}

function formatReplacementResult(value) {
    if (Array.isArray(value)) {
        return value.length ? value.map(v => formatReplacementResult(v)).join() : "undefined";
    } else {
        const str = String(value).trim();
        const isQuotable = str.match(/^[a-z][\w\s\.-]*$/i);
        return isQuotable ? `"${str}"` : str;
    }
}

function replaceFormulaData(formula, data, {missing, warn=false}={}) {
    // Duplicated: core / Roll.replaceFormulaData
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

function castPrimitive(input) {
    if (input && !Number.isNumeric(input)) {
        if (String(input)[0] == '"') {
            return input;
        } else {
            return `"${input}"`;
        }
    }
    return input;
}

function safeEval(expression) {
    // Duplicated: core / Roll.safeEval
    let result;
    try {
        const src = 'with (sandbox) { return ' + expression + '}';
        const evl = new Function('sandbox', src);
        result = evl(this.MATH_PROXY);
    } catch {
        result = undefined;
    }
    return castPrimitive(result);
}

function evaluateTotal() {
    // Duplicated: core / Roll._evaluateTotal
    const expression = this.terms.map(t => t.total).join(" ");
    const total = this.constructor.safeEval(expression);
    return castPrimitive(total);
}

function stringTermEvaluate() {
    this.term = castPrimitive(this.term);
    return this;
}