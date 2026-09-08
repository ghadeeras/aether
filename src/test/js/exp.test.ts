import { Expression } from "../../prod/js/exp.js"

describe("Exp", () => {

    it.skip("works!", () => {
        const x = Expression.variable("x")
        const y = Expression.variable("y")
        const a = Expression.variable("a")
        const t = Expression.variable("t")
        const PI = Expression.variable("PI")
        const two = Expression.constant(2)

        const expXY = x.pow(two).plus(y.pow(two)).get("sqrt")
        const expYX = y.pow(two).plus(x.pow(two)).get("sqrt")
        const expA = expXY.where({ x: a.get("cos"), y: a.get("sin") })

        const expT = expA.where({ a: two.times(PI).times(t) })
        const expTT = expA.where({ a: t.times(two.times(Expression.constant(Math.PI))) })
        const exp = expT.where({ t: two })

        console.log(expXY.toString(), " = ", expXY.evaluate({x: 3, y: 4}), expXY.variables)
        console.log(expA.toString(), " = ", expA.evaluate({a: Math.PI / 3}), expA.variables)
        console.log(expT.toString(), " = ", expT.evaluate({t: 2, PI: Math.PI}), expT.variables)
        console.log(exp.toString(), " = ", exp.evaluate(Math), exp.variables)

        console.log(expXY.depth, expXY.complexity)
        console.log(expXY.hash)
        console.log(expYX.hash)
        console.log(expT.hash)
        console.log(expTT.hash)

        const dExpXY_dX = expXY.partialDerivative("x")
        console.log(dExpXY_dX.toString())
        const dExpA_dA = expA.partialDerivative("a")
        console.log(dExpA_dA.toString())

        console.log(expXY.equals(expYX))
        console.log(expT.equals(expTT))

        console.log(toJSON(expT.match(expA)))
        
        console.log(expT.toString(), " == ", expT.simplified.toString())
        console.log(dExpXY_dX.toString(), " == ", dExpXY_dX.simplified.toString())
        console.log(dExpA_dA.toString(), " == ", dExpA_dA.simplified.toString())
    })

})

function toJSON(value: any): string {
    return JSON.stringify(value, (_, v: any) => v instanceof Expression ? v.toString() : v, 2)
}
