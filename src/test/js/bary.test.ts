import { expect } from "chai"
import { Bary } from "../../prod/index.js"
import { approximateEquality, EPSILON, math3, using } from "./test.utils.js"

describe(">>> bary", using(() => {

    it("has symmetric functions, toCartesian and fromCartesian, that inverse each other", using(gen => {
        const math = math3(gen)
        const [v1, v2, v3, b1] = math.vectors()
        const bary = new Bary(v1, v2, v3)
        const v = bary.toCartesian(b1)
        const b2 = bary.fromCartesian(v)
        expect(b1).to.satisfy(approximateEquality(b2))
    }))

    it("generates coplanar vectors for valid barycentric coordinates", using(gen => {
        const math = math3(gen)
        const [v1, v2, v3, b] = math.vectors()
        const bary = new Bary(v1, v2, v3)
        const b1 = math.vec.scale(b, 1 / (b[0] + b[1] + b[2])) // normalize b to make it a valid barycentric coordinate
        const v = bary.toCartesian(b1)
        const m = math.mat.from([
            ...math.vec.sub(v1, v), 
            ...math.vec.sub(v2, v), 
            ...math.vec.sub(v3, v)
        ])
        expect(math.mat.determinant(m)).to.be.closeTo(0, EPSILON)
    }))
    
}))
