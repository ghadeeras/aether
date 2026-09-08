import { hash, type HasHash } from "./hash.js"

export class Expression<V extends string> implements HasHash {

    private constructor(readonly exp: Exp<V>) {}

    static constant<V extends string = never>(value: number): Expression<V> {
        return new Expression({ type: "constant", value })
    }

    static variable<V extends string>(name: V): Expression<V> {
        return new Expression({ type: "variable", name })
    }

    static sum<V extends string>(...operands: Expression<V>[]): Expression<V> {
        if (operands.length < 2) {
            return operands[0] ?? Expression.constant(0)
        }
        return new Expression({ 
            type: "sum", 
            operands: operands.flatMap(o => o.exp.type === "sum" ? o.exp.operands : [o]) }
        )
    }

    static prod<V extends string>(...operands: Expression<V>[]): Expression<V> {
        if (operands.length < 2) {
            return operands[0] ?? Expression.constant(1)
        }
        return new Expression({ 
            type: "prod", 
            operands: operands.flatMap(o => o.exp.type === "prod" ? o.exp.operands : [o]) 
        })
    }

    neg(): Expression<V> {
        return this.get("neg")
    }

    inv(): Expression<V> {
        return this.get("inv")
    }

    get(fnName: MathFunctionName): Expression<V> {
        return new Expression({ type: "fnCall", name: fnName, arg: this })
    }

    plus<U extends string>(that: Expression<U>): Expression<V | U> {
        return Expression.sum<V | U>(this, that)
    }

    minus<U extends string>(that: Expression<U>): Expression<V | U> {
        return this.plus(that.neg())
    }

    times<U extends string>(that: Expression<U>): Expression<V | U> {
        return Expression.prod<V | U>(this, that)
    }

    div<U extends string>(that: Expression<U>): Expression<V | U> {
        return this.times(that.inv())
    }

    pow<U extends string>(that: Expression<U>): Expression<V | U> {
        return new Expression<V | U>({ type: "pow", base: this, exponent: that })
    }

    private _variables = Lazy.from(() => {
        return [...new Set(variables(this))]

        function variables(e: Expression<V>): V[] {
            switch (e.exp.type) {
                case "constant": return []
                case "variable": return [e.exp.name]
                case "fnCall"  : return variables(e.exp.arg)
                case "sum"     : return e.exp.operands.flatMap(o => variables(o))
                case "prod"    : return e.exp.operands.flatMap(o => variables(o))
                case "pow"     : return [e.exp.base, e.exp.exponent].flatMap(o => variables(o))
            }
        }
    })

    get variables(): V[] {
        return this._variables.value
    }

    get isConstant(): boolean {
        return this.variables.length === 0
    }

    get isNonLiteralConstant(): boolean {
        return this.isConstant && this.exp.type !== "constant"
    }

    evaluate(variables: Record<V, number>): number {
        switch (this.exp.type) {
            case "constant": return this.exp.value
            case "variable": return variables[this.exp.name]
            case "fnCall"  : return evaluateFnCall(this.exp.name, this.exp.arg, variables)
            case "sum"     : return this.exp.operands.map(e => e.evaluate(variables)).reduce((v1, v2) => v1 + v2, 0)
            case "prod"    : return this.exp.operands.map(e => e.evaluate(variables)).reduce((v1, v2) => v1 * v2, 1)
            case "pow"     : return this.exp.base.evaluate(variables) ** this.exp.exponent.evaluate(variables)
        }

        function evaluateFnCall<V extends string, E extends string>(name: MathFunctionName, arg: Expression<V>, variables: Record<V | E, number>): number {
            const value = arg.evaluate(variables)
            switch (name) {
                case "neg": return -value
                case "inv": return 1 / value
                default   : return Math[name](value)
            }
        }
    }

    private _valueIfConstant = Lazy.from(() => this.isConstant ? this.evaluate({} as Record<V, number>) : null)

    get valueIfConstant(): number | null {
        return this._valueIfConstant.value
    }

    asConstant(): Expression<never> | null {
        return this.valueIfConstant !== null ? Expression.constant(this.valueIfConstant) : null
    }

    asConstantOr<U extends string>(otherwise: Expression<U>): Expression<U> {
        return this.asConstant() ?? otherwise
    }

    where<OV extends V, NV extends string>(variables: Record<OV, Expression<NV>>): Expression<NV | Exclude<V, OV>> {
        switch (this.exp.type) {
            case "constant": return Expression.constant(this.exp.value)
            case "variable": return this.exp.name in variables ? variables[this.exp.name as OV] : Expression.variable(this.exp.name as Exclude<V, OV>)
            case "fnCall"  : return this.exp.arg.where(variables).get(this.exp.name)
            case "sum"     : return Expression.sum(...this.exp.operands.map(e => e.where(variables)))
            case "prod"    : return Expression.prod(...this.exp.operands.map(e => e.where(variables)))
            case "pow"     : return this.exp.base.where(variables).pow(this.exp.exponent.where(variables))
        }
    }

    partialDerivative<X extends V>(variable: X): Expression<V> {
        switch (this.exp.type) {
            case "constant": return Expression.constant(0)
            case "variable": return this.exp.name === variable ? Expression.constant(1) : Expression.constant(0)
            case "fnCall"  : return fnDeriv(this, this.exp.name, this.exp.arg, this.exp.arg.partialDerivative(variable))
            case "sum"     : return Expression.sum(...this.exp.operands.map(o => o.partialDerivative(variable)))
            case "prod"    : return Expression.sum(...this.exp.operands.map((o, _, operands) => Expression.prod(o.partialDerivative(variable), ...operands.filter(op => op !== o))))
            case "pow"     : return powDeriv(this.exp.base, this.exp.exponent, this.exp.base.partialDerivative(variable), this.exp.exponent.partialDerivative(variable))
        }

        function powDeriv(base: Expression<V>, exponent: Expression<V>, baseDeriv: Expression<V>, expDeriv: Expression<V>): Expression<V> {
            const varBaseDeriv = exponent.times(baseDeriv).times(base.pow(exponent.minus(Expression.constant(1))))
            const varExponentDeriv = base.get("log").times(expDeriv).times(base.pow(exponent))
            if (exponent.variables.length === 0) {
                return varBaseDeriv
            }
            if (base.variables.length === 0) {
                return varExponentDeriv
            }
            return varBaseDeriv.plus(varExponentDeriv)
        }

        function fnDeriv(exp: Expression<V>, name: MathFunctionName, arg: Expression<V>, argDeriv: Expression<V>): Expression<V> {
            switch (name) {
                case "neg" : return argDeriv.neg()
                case "inv" : return argDeriv.times(arg.pow(Expression.constant(-2))).neg()
                case "sin" : return argDeriv.times(arg.get("cos"))
                case "cos" : return argDeriv.times(arg.get("sin")).neg()
                case "exp" : return argDeriv.times(exp)
                case "log" : return argDeriv.div(arg)
                case "sqrt": return Expression.constant(0.5).times(argDeriv).div(exp)
                default    : throw new Error(`Unsupported function derivative: ${name}`)
            }
        }
    }

    equals(that: Expression<V>): boolean {
        if (this.hash !== that.hash) {
            return false
        }
        if (this.variables.length !== that.variables.length) {
            return false
        }
        switch (this.exp.type) {
            case "constant": return that.exp.type === "constant" && this.exp.value === that.exp.value
            case "variable": return that.exp.type === "variable" && this.exp.name === that.exp.name
            case "fnCall"  : return that.exp.type === "fnCall"   && this.exp.name === that.exp.name && this.exp.arg.equals(that.exp.arg)
            case "sum"     : return that.exp.type === "sum"      && equals(this.exp.operands, that.exp.operands)
            case "prod"    : return that.exp.type === "prod"     && equals(this.exp.operands, that.exp.operands)
            case "pow"     : return that.exp.type === "pow"      && this.exp.base.equals(that.exp.base) && this.exp.exponent.equals(that.exp.exponent)
        }

        function equals(operands1: Expression<V>[], operands2: Expression<V>[]): boolean {
            if (operands1.length !== operands2.length) {
                return false
            }
            const o1 = [...operands1].sort((a, b) => a.exp.type.localeCompare(b.exp.type) || (a.hash - b.hash))
            const o2 = [...operands2].sort((a, b) => a.exp.type.localeCompare(b.exp.type) || (a.hash - b.hash))
            return o1.every((o, i) => o2[i] && o.equals(o2[i]))
        }
    }

    private _hash = Lazy.from(() => {
        switch (this.exp.type) {
            case "sum"     : 
            case "prod"    : return this.exp.operands.map(hash).reduce((a, b) => a + b, 0)
            default        : return hash(this.exp)
        }
    })

    get hash(): number {
        return this._hash.value
    }

    match<U extends string>(that: Expression<U>): Record<U, Expression<V>>[] {
        return match(this, that) as Record<U, Expression<V>>[]

        function match<U extends string>(thisExp: Expression<V>, thatExp: Expression<U>): Partial<Record<U, Expression<V>>>[] {
            switch (thatExp.exp.type) {
                case "constant": return thisExp.exp.type === "constant" && thisExp.exp.value === thatExp.exp.value ? [{}] : mismatch()
                case "variable": return [pair(thatExp.exp.name, thisExp)]
                case "fnCall"  : return thisExp.exp.type === "fnCall" && thisExp.exp.name === thatExp.exp.name ? thisExp.exp.arg.match(thatExp.exp.arg) : mismatch()
                case "sum"     : return thisExp.exp.type === "sum"  ? matchAll(thisExp.exp.operands, thatExp.exp.operands, Expression.sum) : mismatch()
                case "prod"    : return thisExp.exp.type === "prod" ? matchAll(thisExp.exp.operands, thatExp.exp.operands, Expression.prod) : mismatch()
                case "pow"     : return thisExp.exp.type === "pow"  ? prod(thisExp.exp.base.match(thatExp.exp.base), thisExp.exp.exponent.match(thatExp.exp.exponent)) : mismatch()
            }
        }

        function pair<U extends string>(name: U, exp: Expression<V>): Partial<Record<U, Expression<V>>> {
            const result: Partial<Record<U, Expression<V>>> = {}
            result[name] = exp
            return result
        }

        function matchAll<U extends string>(exps1: Expression<V>[], exps2: Expression<U>[], reducer: (...exps: Expression<V>[]) => Expression<V>): Partial<Record<U, Expression<V>>>[] {
            const groupings = [...partitionings(exps2.length, exps1)]
                .filter(p => p.every(exps => exps.length < exps1.length))
                .map(p => p.map(exps => reducer(...exps)))
            return groupings.flatMap(es1 => es1
                .map((e1, i) => e1.match(exps2[i] ?? Expression.constant(0)))
                .reduce<Partial<Record<U, Expression<V>>>[]>((a, r) => prod(a, r), [{}])
            )
        }

        function prod<U extends string>(results1: Partial<Record<U, Expression<V>>>[], results2: Partial<Record<U, Expression<V>>>[]): Partial<Record<U, Expression<V>>>[] {
            return results1.flatMap(e1 => results2.flatMap(e2 => merge(e1, e2)))
        }

        function merge<U extends string>(result1: Partial<Record<U, Expression<V>>>, result2: Partial<Record<U, Expression<V>>>): Partial<Record<U, Expression<V>>>[] {
            const result = { ...result1 }
            for (const key in result2) {
                if (key in result1) {
                    const exp1 = result1[key] ?? Expression.constant(0)
                    const exp2 = result2[key] ?? Expression.constant(0)
                    if (!exp1.equals(exp2)) {
                        return mismatch()
                    }
                } else {
                    result[key] = result2[key]
                }
            }
            return [result]
        }

        function mismatch<U extends string>(): Partial<Record<U, Expression<V>>>[] {
            return []
        }
    }

    private _depth = Lazy.from(() => {
        return depth(this)

        function depth<V extends string>(exp: Expression<V>): number {
            switch (exp.exp.type) {
                case "fnCall": return depth(exp.exp.arg) + 1
                case "sum"   : return Math.max(...exp.exp.operands.map(depth)) + 1
                case "prod"  : return Math.max(...exp.exp.operands.map(depth)) + 1
                case "pow"   : return Math.max(...[exp.exp.base, exp.exp.exponent].map(o => depth(o))) + 1
                default      : return 0
            }
        }
    })

    get depth(): number {
        return this._depth.value
    }

    private _complexity = Lazy.from(() => {
        return complexity(this)
        
        function complexity<V extends string>(exp: Expression<V>): number {
            switch (exp.exp.type) {
                case "fnCall": return complexity(exp.exp.arg) + 1
                case "sum"   : return exp.exp.operands.map(complexity).reduce((l1, l2) => l1 + l2, exp.exp.operands.length)
                case "prod"  : return exp.exp.operands.map(complexity).reduce((l1, l2) => l1 + l2, exp.exp.operands.length)
                case "pow"   : return complexity(exp.exp.base) + complexity(exp.exp.exponent) + 1
                default      : return 0
            }
        }
    })

    get complexity(): number {
        return this._complexity.value
    }

    private _simplified = Lazy.from(() => simplifier.transform(this))

    get simplified(): Expression<V> {
        return this._simplified.value
    }

    toString(): string {
        switch (this.exp.type) {
            case "constant": return this.exp.value.toString()
            case "variable": return this.exp.name
            case "fnCall"  : return fnCallAsString(this, this.exp.name, this.exp.arg)
            case "sum"     : return sumAsString(this, this.exp.operands)
            case "prod"    : return prodAsString(this, this.exp.operands)
            case "pow"     : return [this.exp.base, this.exp.exponent].map(e => subString(this, e)).join(" ^ ")
        }

        function fnCallAsString(parent: Expression<V>, name: string, exp: Expression<V>) {
            switch (name) {
                case "neg": return `-${subString(parent, exp)}`
                case "inv": return `1 / ${subString(parent, exp)}`
                default   : return `${name}(${exp.toString()})`
            }
        }

        function sumAsString(parent: Expression<V>, operands: Expression<V>[]): string {
            return operands
                .flatMap((e, i) => i === 0 ? [e] : asSignedExp(e))
                .map(e => e instanceof Expression ? subString(parent, e) : e)
                .join(" ")
        }

        function prodAsString(parent: Expression<V>, operands: Expression<V>[]): string {
            return operands
                .flatMap((e, i) => i === 0 ? [e] : asProdFactor(e))
                .map(e => e instanceof Expression ? subString(parent, e) : e)
                .join(" ")
        }

        function subString(thisExp: Expression<V>, thatExp: Expression<V>): string {
            const thisP = thisExp.precedence
            const thatP = thatExp.precedence
            const s = thatExp.toString()
            return thatP < thisP || thisP === 3 && thatP === 3 ? `(${s})` : s
        }

        function asSignedExp(thisExp: Expression<V>): ["+" | "-", Expression<V>] {
            switch (thisExp.exp.type) {
                case "constant": return thisExp.exp.value >= 0     ? ["+", thisExp] : ["-", Expression.constant(-(thisExp.exp.value ?? 0))]
                case "fnCall"  : return thisExp.exp.name !== "neg" ? ["+", thisExp] : ["-", thisExp.exp.arg]
                default        : return                              ["+", thisExp]
            }

        }

        function asProdFactor(thisExp: Expression<V>): ["*" | "/", Expression<V>] {
            switch (thisExp.exp.type) {
                case "fnCall": return thisExp.exp.name === "inv" ? ["/", thisExp.exp.arg] : ["*", thisExp]
                default      : return ["*", thisExp]
            }
        }

    }

    private _precedence = Lazy.from(() => {
        switch (this.exp.type) {
            case "fnCall": return this.exp.name === "neg" || this.exp.name === "inv" ? 2 : 4
            case "sum"   : return 0
            case "prod"  : return 1
            case "pow"   : return 3
            default      : return 4
        }
    })

    get precedence(): number {
        return this._precedence.value
    }

}

export type Exp<V extends string> = never 
    | { type: "constant", value: number } 
    | { type: "variable", name: V } 
    | { type: "fnCall"  , name: MathFunctionName, arg: Expression<V> } 
    | { type: "sum"     , operands: Expression<V>[] } 
    | { type: "prod"    , operands: Expression<V>[] } 
    | { type: "pow"     , base: Expression<V>, exponent: Expression<V> }


export type MathFunctionName = "neg" | "inv" | "sin" | "cos" | "exp" | "log" | "sqrt"

class Lazy<T> {

    private _value: T | null = null

    constructor(private _supplier: () => T) {}

    get value(): T {
        return this._value !== null ? this._value : (this._value = this._supplier())
    }

    static from<T>(supplier: () => T): Lazy<T> {
        return new Lazy(supplier)
    }

}

function *partitionings<T>(n: number, set: T[]): Generator<T[][]> {
    const [head, ...tail] = set
    if (head !== undefined) {
        for (const p of partitionings(n, tail)) {
            for (let i = 0; i < p.length; i++) {
                yield p.map((s, j) => j === i ? [head, ...s] : s)
            }
        }
    } else {
        const p: T[][] = []
        for (let i = 0; i < n; i++) {
            p.push([])
        }
        yield p
    }
}

export interface ExpressionTransformationRule {

    transform<V extends string>(exp: Expression<V>): Expression<V>

}

export function patternBased<V extends string, SV extends V>(
    inputPattern: Expression<V>, 
    outputPattern: Expression<SV> | (<U extends string>(match: Record<V, Expression<U>>) => Expression<SV> | null), 
): ExpressionTransformationRule {
    return new PatternBasedTransformationRule(inputPattern, outputPattern)
}

export function recursive(rule: ExpressionTransformationRule): ExpressionTransformationRule {
    return new RecursiveTranformationRule(rule)
}

export function composite(...rules: ExpressionTransformationRule[]): ExpressionTransformationRule {
    return new CompositeTransformationRule(rules)
}

class RecursiveTranformationRule implements ExpressionTransformationRule {

    constructor(private rule: ExpressionTransformationRule) {}

    transform<V extends string>(exp: Expression<V>): Expression<V> {
        return this.rule.transform(deepTransform(this, exp))

        function deepTransform(rule: RecursiveTranformationRule, exp: Expression<V>): Expression<V> {
            switch (exp.exp.type) {
                case "constant": return exp
                case "variable": return exp
                case "fnCall"  : return rule.transform(exp.exp.arg).get(exp.exp.name)
                case "sum"     : return Expression.sum(...exp.exp.operands.map(e => rule.transform(e)))
                case "prod"    : return Expression.prod(...exp.exp.operands.map(e => rule.transform(e)))
                case "pow"     : return rule.transform(exp.exp.base).pow(rule.transform(exp.exp.exponent))
            }
        }
    }

}

class CompositeTransformationRule implements ExpressionTransformationRule {
    
    constructor(private rules: ExpressionTransformationRule[]) {}
    
    transform<V extends string>(exp: Expression<V>): Expression<V> {
        return this.rules.reduce((e, r) => r.transform(e), exp)
    }

}

class PatternBasedTransformationRule<V extends string> implements ExpressionTransformationRule {

    constructor(
        private inputPattern: Expression<V>, 
        private outputPattern: Expression<V> | (<U extends string>(match: Record<V, Expression<U>>) => Expression<V> | null), 
    ) {}

    transform<U extends string>(exp: Expression<U>): Expression<U> {
        const matches = exp.match(this.inputPattern)
        for (const match of matches) {
            const p = this.outputPattern instanceof Expression ? this.outputPattern : this.outputPattern(match)
            if (p === null) {
                continue
            }
            return p.where(match)
        }
        return exp
    }

}

const zero = Expression.constant(0)
const one  = Expression.constant(1)
const two  = Expression.constant(2)
const x    = Expression.variable("x")
const y    = Expression.variable("y")

const constExp = patternBased(
    x,
    m => m.x.isNonLiteralConstant ? m.x.asConstantOr(x) : null,
)
const plusConst = patternBased(
    x.plus(y), 
    m => false ? null
        : m.x.valueIfConstant === 0 ? y
        : m.x.isNonLiteralConstant  ? m.x.asConstantOr(x).plus(y) 
        : null
)
const timesConst = patternBased(
    x.times(y), 
    m => false ? null
        : m.x.valueIfConstant === 0 ? zero // <--- Not quite correct
        : m.x.valueIfConstant === 1 ? y 
        : m.x.isNonLiteralConstant  ? m.x.asConstantOr(x).times(y) 
        : null
)
const powConst = patternBased(
    x.pow(y), 
    m => false ? null
        : m.x.valueIfConstant === 0 && m.y.valueIfConstant !== 0 ? zero
        : m.x.valueIfConstant !== 0 && m.y.valueIfConstant === 0 ? one
        : m.x.valueIfConstant === 1 && m.y.valueIfConstant !== 1 ? one
        : m.x.valueIfConstant !== 1 && m.y.valueIfConstant === 1 ? x
        : null
)
const xMinusX = patternBased(
    x.minus(x).plus(y),
    y
)
const xDivX = patternBased(
    x.div(x).times(y),
    y
)
const xTimesMinusY = patternBased(
    x.times(y.neg()),
    x.times(y).neg()
)
const unitCircle = patternBased(
    x.get("cos").pow(two).plus(x.get("sin").pow(two)), 
    Expression.constant(1)
)

class SimplificationRule implements ExpressionTransformationRule {

    constructor(private rule: ExpressionTransformationRule, private iterations = 256) {}

    transform<V extends string>(exp: Expression<V>): Expression<V> {
        let simplest = exp
        let latest = exp
        for (let i = 0; i < this.iterations; i++) {
            const next = this.rule.transform(latest)
            if (next.complexity < simplest.complexity) {
                i = 0
                simplest = next
                latest = next
                if (simplest.complexity === 0) {
                    break
                } else {
                    continue
                }
            }
            if (next.equals(latest)) {
                break
            }
            latest = next
        }
        return simplest
    }

}

const simplifier: ExpressionTransformationRule = recursive(new SimplificationRule(recursive(composite(
    constExp,
    plusConst,
    timesConst,
    powConst,
    xMinusX,
    xDivX,
    xTimesMinusY,
    unitCircle,
))))
