import { expect } from "chai"
import { approximateEquality } from "./test.utils.js"
import { rtNode, waNode } from "vibrato.js"
import * as aether from "../../prod/index.js"

const scalarFieldModule = loadScalarFieldModule()

describe("ScalarField", () => {

    const resolution = 20
    const samples = randomSamples(resolution)
    const instance = scalarFieldModule.newInstance()
    instance.resolution = resolution
    instance.sampler = sampler(samples)

    describe("get", () => {
        
        it("interpolates samples", () => {
            const vec = instance.get(0.11, 0.22, 0.33)
            const expectedVec = aether.vec4.addAll(
                aether.vec4.scale(samples[13][12][11], 0.7 * 0.8 * 0.9),
                aether.vec4.scale(samples[13][12][12], 0.7 * 0.8 * 0.1),
                aether.vec4.scale(samples[13][13][11], 0.7 * 0.2 * 0.9),
                aether.vec4.scale(samples[13][13][12], 0.7 * 0.2 * 0.1),
                aether.vec4.scale(samples[14][12][11], 0.3 * 0.8 * 0.9),
                aether.vec4.scale(samples[14][12][12], 0.3 * 0.8 * 0.1),
                aether.vec4.scale(samples[14][13][11], 0.3 * 0.2 * 0.9),
                aether.vec4.scale(samples[14][13][12], 0.3 * 0.2 * 0.1)
            )
            expect(vec).to.satisfy(approximateEquality(expectedVec))
        })
    
        it("could return exact same samples", () => {
            const vec = instance.get(-0.3, -0.2, -0.1)
            const expectedVec = samples[9][8][7]
            expect(vec).to.deep.equal(expectedVec)
        })
    
        it("handles bounds properly", () => {
            const vec1 = instance.get(-1, -1, -1)
            const vec2 = instance.get(+1, +1, +1)
            const expectedVec1 = samples[0][0][0]
            const expectedVec2 = samples[resolution][resolution][resolution]
            expect(vec1).to.deep.equal(expectedVec1)
            expect(vec2).to.deep.equal(expectedVec2)
        })
    
        it("returns zero for out of bounds coordinates", () => {
            const vec1 = instance.get(-1.01, -1.01, -1.01)
            const vec2 = instance.get(+1.01, +1.01, +1.01)
            const zero = aether.vec4.of(0, 0, 0, 0)
            expect(vec1).to.deep.equal(zero)
            expect(vec2).to.deep.equal(zero)
        })

    })

    describe("getNearest", () => {
        
        it("gets nearest samples", () => {
            const vec1 = instance.getNearest(0.14, 0.25, 0.36)
            const vec2 = instance.getNearest(0.15, 0.26, 0.34)
            const expectedVec1 = samples[14][12][11]
            const expectedVec2 = samples[13][13][12]
            expect(vec1).to.satisfy(approximateEquality(expectedVec1))
            expect(vec2).to.satisfy(approximateEquality(expectedVec2))
        })
    
        it("returns exact same samples", () => {
            const vec = instance.getNearest(-0.3, -0.2, -0.1)
            const expectedVec = samples[9][8][7]
            expect(vec).to.deep.equal(expectedVec)
        })
    
        it("handles bounds properly", () => {
            const vec1 = instance.getNearest(-1.04, -1.04, -1.04)
            const vec2 = instance.getNearest(+1.04, +1.04, +1.04)
            const expectedVec1 = samples[0][0][0]
            const expectedVec2 = samples[resolution][resolution][resolution]
            expect(vec1).to.deep.equal(expectedVec1)
            expect(vec2).to.deep.equal(expectedVec2)
        })
    
        it("returns zero for out of bounds coordinates", () => {
            const vec1 = instance.getNearest(-1.1, -1.1, -1.1)
            const vec2 = instance.getNearest(+1.1, +1.1, +1.1)
            const zero = aether.vec4.of(0, 0, 0, 0)
            expect(vec1).to.deep.equal(zero)
            expect(vec2).to.deep.equal(zero)
        })

    })

})

function sampler(samples: aether.Vec4[][][]): aether.ScalarFieldSampler {
    const resolution = samples.length - 1
    return (x, y, z) => {
        const xx = Math.round((x + 1) * resolution / 2)
        const yy = Math.round((y + 1) * resolution / 2)
        const zz = Math.round((z + 1) * resolution / 2)
        const result = xx < 0 || xx > resolution || yy < 0 || yy > resolution || zz < 0 || zz > resolution ?
            aether.vec4.of(0, 0, 0, 0) :
            samples[zz][yy][xx]
        if (!result) {
            console.log(x, y, z)
        }
        return result
    }
}

function randomSamples(resolution: number): aether.Vec4[][][] {
    const vecGen = aether.vec4.gen(() => Math.random())
    const samples: aether.Vec4[][][] = []
    for (let z = 0; z <= resolution; z++) {
        const zGrids: aether.Vec4[][] = []
        for (let y = 0; y <= resolution; y++) {
            const yRows: aether.Vec4[] = []
            for (let x = 0; x <= resolution; x++) {
                yRows.push(vecGen())
            }
            zGrids.push(yRows)
        }
        samples.push(zGrids)
    }
    return samples
}

function loadScalarFieldModule(): aether.ScalarFieldModule {
    const modules = waNode.fsLoadModules("./out/prod/wa", {
        ...aether.modulePaths,
        scalarField: aether.modulePaths.scalarField.replace("latest", "prod"),
    })
    return aether.scalarFieldModule(modules, rtNode.runtime())
}

