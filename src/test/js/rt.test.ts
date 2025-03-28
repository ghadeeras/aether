import { expect } from 'chai'
import * as rt from '../../prod/js/rt.js'
import fs from 'fs'

describe("Runtime", async () => {

    const runtime = await rt.syncRuntime(null, fs.readFileSync)
    const mem = notNull(runtime.exports.mem, "Couldn't load Vibrato runtime 'mem' module !")
    const space = notNull(runtime.exports.space, "Couldn't load Vibrato runtime 'space' module!")
    const delay = notNull(runtime.exports.delay, "Couldn't load Vibrato runtime 'delay' module!")
    
    let location = 0
    
    beforeEach(() => {
        mem.enter()
        location = mem.allocate8(randomInt()) - 4
    })

    afterEach(() => {
        mem.leave()
        expect(mem.allocate8(0)).to.equal(location)
    })

    describe("mem", () => {

        describe("allocate8", () => {
    
            it("allocates specified number of bytes on the stack", () => {
                const size = randomInt(8)
                const ref1 = mem.allocate8(size)
                const ref2 = mem.allocate8(0)
                expect(ref1).to.be.gte(location)
                expect(ref2 - ref1).to.equal(size)
            })
    
        })
    
        describe("allocate16", () => {
    
            it("allocates specified number of 16-bit words on the stack", () => {
                const size = randomInt(8)
                const ref1 = mem.allocate16(size)
                const ref2 = mem.allocate16(0)
                expect(ref1).to.be.gte(location)
                expect(ref2 - ref1).to.equal(2 * size)
            })
    
            it("returns 2-byte aligned addresses", () => {
                for (let i = 0; i < 2; i++) {
                    mem.allocate8(i)
                    const ref = mem.allocate16(randomInt(8))
                    expect(ref % 2).to.equal(0)
                }
            })
    
        })
    
        describe("allocate32", () => {
    
            it("allocates specified number of 32-bit words on the stack", () => {
                const size = randomInt(8)
                const ref1 = mem.allocate32(size)
                const ref2 = mem.allocate32(0)
                expect(ref1).to.be.gte(location)
                expect(ref2 - ref1).to.equal(4 * size)
            })
    
            it("returns 4-byte aligned addresses", () => {
                for (let i = 0; i < 4; i++) {
                    mem.allocate8(i)
                    const ref = mem.allocate32(randomInt(8))
                    expect(ref % 4).to.equal(0)
                }
            })
    
        })
    
        describe("allocate64", () => {
    
            it("allocates specified number of 64-bit words on the stack", () => {
                const size = randomInt(8)
                const ref1 = mem.allocate64(size)
                const ref2 = mem.allocate64(0)
                expect(ref1).to.be.gte(location)
                expect(ref2 - ref1).to.equal(8 * size)
            })
    
            it("returns 8-byte aligned addresses", () => {
                for (let i = 0; i < 8; i++) {
                    mem.allocate8(i)
                    const ref = mem.allocate64(randomInt(8))
                    expect(ref % 8).to.equal(0)
                }
            })
    
        })

    })

    describe("delay", () => {

        it("initializes a delay line", () => {
            const delayLineLength = randomInt(5, 64)
            const entrySize = randomInt(5, 64)
            const delayLine = delay.create_delay(delayLineLength, entrySize)

            const [
                length, 
                itemSize, 
                bufferSize, 
                bufferLoRef, 
                bufferHiRef, 
                firstItemRef
            ] = new Uint32Array(mem.stack.buffer, delayLine, 6)
            
            expect(length).to.equal(delayLineLength)
            expect(itemSize).to.equal(entrySize)
            expect(bufferSize).to.equal(length * itemSize)
            expect(bufferLoRef).to.equal(delayLine + 6 * 4)
            expect(bufferHiRef - bufferLoRef).to.equal(bufferSize)
            expect(firstItemRef).to.equal(bufferLoRef)
        })

        it("allows random access into a delay", () => {
            const delayLineLength = randomInt(5, 64)
            const entrySize = randomInt(5, 64)
            const delayLine = delay.create_delay(delayLineLength, entrySize)
            
            const first = delay.item_ref(delayLine, 0)
            const last = delay.item_ref(delayLine, delayLineLength - 1)
            
            expect(last + entrySize - first).to.equal(delayLineLength * entrySize)
            expect(delay.item_ref(delayLine, -delayLineLength)).to.equal(first)
            expect(delay.item_ref(delayLine, -1)).to.equal(last)

            const index = randomInt(0, 0x10000)
            expect(delay.item_ref(delayLine, +index)).to.equal(delay.item_ref(delayLine, +(index % delayLineLength)))
            expect(delay.item_ref(delayLine, -index)).to.equal(delay.item_ref(delayLine, -(index % delayLineLength)))
        })

        it("allows rotating a delay", () => {
            const delayLineLength = randomInt(5, 64)
            const entrySize = randomInt(5, 64)
            const delayLine = delay.create_delay(delayLineLength, entrySize)
            
            const prevFirst = delay.item_ref(delayLine, -delayLineLength)
            const prevLast = delay.item_ref(delayLine, -1)

            delay.rotate(delayLine)
            
            const first = delay.item_ref(delayLine, -delayLineLength)
            const last = delay.item_ref(delayLine, -1)

            expect(first).to.equal(prevFirst + entrySize)
            expect(last).to.equal(prevFirst)
            expect(delay.item_ref(delayLine, -2)).to.equal(prevLast)
        })

    })

    describe("space", () => {

        const notZero = (n: number): boolean => n != 0

        describe("real vector add", () => {

            it("adds 2D real vector to another", () => {
                const [ref1, v1] = randomVector(2)
                const [ref2, v2] = randomVector(2)
    
                const ref = space.f64_vec2_add(ref1, ref2)
                const vector = new Float64Array(mem.stack.buffer, ref, 2)
    
                vector.forEach((v, i) => expect(v).to.equal(v1[i] + v2[i]))
            })

            it("adds 3D real vector to another", () => {
                const [ref1, v1] = randomVector(3)
                const [ref2, v2] = randomVector(3)
    
                const ref = space.f64_vec3_add(ref1, ref2)
                const vector = new Float64Array(mem.stack.buffer, ref, 3)
    
                vector.forEach((v, i) => expect(v).to.equal(v1[i] + v2[i]))
            })

            it("adds 4D real vector to another", () => {
                const [ref1, v1] = randomVector(4)
                const [ref2, v2] = randomVector(4)
    
                const ref = space.f64_vec4_add(ref1, ref2)
                const vector = new Float64Array(mem.stack.buffer, ref, 4)
    
                vector.forEach((v, i) => expect(v).to.equal(v1[i] + v2[i]))
            })

            it("adds ND real vector to another", () => {
                const dim = randomInt(5, 64)
                const [ref1, v1] = randomVector(dim)
                const [ref2, v2] = randomVector(dim)
    
                const ref = space.f64_vec_add(dim, ref1, ref2)
                const vector = new Float64Array(mem.stack.buffer, ref, dim)
    
                vector.forEach((v, i) => expect(v).to.equal(v1[i] + v2[i]))
            })

        })

        describe("real vector sub", () => {

            it("subtracts 2D real vector from another", () => {
                const [ref1, v1] = randomVector(2)
                const [ref2, v2] = randomVector(2)
    
                const ref = space.f64_vec2_sub(ref1, ref2)
                const vector = new Float64Array(mem.stack.buffer, ref, 2)
    
                vector.forEach((v, i) => expect(v).to.equal(v1[i] - v2[i]))
            })

            it("subtracts 3D real vector from another", () => {
                const [ref1, v1] = randomVector(3)
                const [ref2, v2] = randomVector(3)
    
                const ref = space.f64_vec3_sub(ref1, ref2)
                const vector = new Float64Array(mem.stack.buffer, ref, 3)
    
                vector.forEach((v, i) => expect(v).to.equal(v1[i] - v2[i]))
            })

            it("subtracts 4D real vector from another", () => {
                const [ref1, v1] = randomVector(4)
                const [ref2, v2] = randomVector(4)
    
                const ref = space.f64_vec4_sub(ref1, ref2)
                const vector = new Float64Array(mem.stack.buffer, ref, 4)
    
                vector.forEach((v, i) => expect(v).to.equal(v1[i] - v2[i]))
            })

            it("subtracts ND real vector from another", () => {
                const dim = randomInt(5, 64)
                const [ref1, v1] = randomVector(dim)
                const [ref2, v2] = randomVector(dim)
    
                const ref = space.f64_vec_sub(dim, ref1, ref2)
                const vector = new Float64Array(mem.stack.buffer, ref, dim)
    
                vector.forEach((v, i) => expect(v).to.equal(v1[i] - v2[i]))
            })

        })

        describe("real vector mul", () => {

            it("multiplies 2D real vector with another", () => {
                const [ref1, v1] = randomVector(2)
                const [ref2, v2] = randomVector(2)
    
                const ref = space.f64_vec2_mul(ref1, ref2)
                const vector = new Float64Array(mem.stack.buffer, ref, 2)
    
                vector.forEach((v, i) => expect(v).to.equal(v1[i] * v2[i]))
            })

            it("multiplies 3D real vector with another", () => {
                const [ref1, v1] = randomVector(3)
                const [ref2, v2] = randomVector(3)
    
                const ref = space.f64_vec3_mul(ref1, ref2)
                const vector = new Float64Array(mem.stack.buffer, ref, 3)
    
                vector.forEach((v, i) => expect(v).to.equal(v1[i] * v2[i]))
            })

            it("multiplies 4D real vector with another", () => {
                const [ref1, v1] = randomVector(4)
                const [ref2, v2] = randomVector(4)
    
                const ref = space.f64_vec4_mul(ref1, ref2)
                const vector = new Float64Array(mem.stack.buffer, ref, 4)
    
                vector.forEach((v, i) => expect(v).to.equal(v1[i] * v2[i]))
            })

            it("multiplies ND real vector with another", () => {
                const dim = randomInt(5, 64)
                const [ref1, v1] = randomVector(dim)
                const [ref2, v2] = randomVector(dim)
    
                const ref = space.f64_vec_mul(dim, ref1, ref2)
                const vector = new Float64Array(mem.stack.buffer, ref, dim)
    
                vector.forEach((v, i) => expect(v).to.equal(v1[i] * v2[i]))
            })

        })

        describe("real vector div", () => {

            it("divides 2D real vector by another", () => {
                const [ref1, v1] = randomVector(2)
                const [ref2, v2] = randomVector(2, notZero)
    
                const ref = space.f64_vec2_div(ref1, ref2)
                const vector = new Float64Array(mem.stack.buffer, ref, 2)
    
                vector.forEach((v, i) => expect(v).to.equal(v1[i] / v2[i]))
            })

            it("divides 3D real vector by another", () => {
                const [ref1, v1] = randomVector(3)
                const [ref2, v2] = randomVector(3, notZero)
    
                const ref = space.f64_vec3_div(ref1, ref2)
                const vector = new Float64Array(mem.stack.buffer, ref, 3)
    
                vector.forEach((v, i) => expect(v).to.equal(v1[i] / v2[i]))
            })

            it("divides 4D real vector by another", () => {
                const [ref1, v1] = randomVector(4)
                const [ref2, v2] = randomVector(4, notZero)
    
                const ref = space.f64_vec4_div(ref1, ref2)
                const vector = new Float64Array(mem.stack.buffer, ref, 4)
    
                vector.forEach((v, i) => expect(v).to.equal(v1[i] / v2[i]))
            })

            it("divides ND real vector by another", () => {
                const dim = randomInt(5, 64)
                const [ref1, v1] = randomVector(dim)
                const [ref2, v2] = randomVector(dim, notZero)
    
                const ref = space.f64_vec_div(dim, ref1, ref2)
                const vector = new Float64Array(mem.stack.buffer, ref, dim)
    
                vector.forEach((v, i) => expect(v).to.equal(v1[i] / v2[i]))
            })

        })

        describe("real vector scalar mul", () => {

            it("multiplies 2D real vector with a scalar", () => {
                const [inRef, inVec] = randomVector(2)
                const s = randomNumber()
    
                const outRef = space.f64_vec2_scalar_mul(inRef, s)
                const outVec = new Float64Array(mem.stack.buffer, outRef, 2)
    
                outVec.forEach((v, i) => expect(v).to.equal(inVec[i] * s))
            })

            it("multiplies 3D real vector with a scalar", () => {
                const [inRef, inVec] = randomVector(3)
                const s = randomNumber()
    
                const outRef = space.f64_vec3_scalar_mul(inRef, s)
                const outVec = new Float64Array(mem.stack.buffer, outRef, 3)
    
                outVec.forEach((v, i) => expect(v).to.equal(inVec[i] * s))
            })

            it("multiplies 4D real vector with a scalar", () => {
                const [inRef, inVec] = randomVector(4)
                const s = randomNumber()
    
                const outRef = space.f64_vec4_scalar_mul(inRef, s)
                const outVec = new Float64Array(mem.stack.buffer, outRef, 4)
    
                outVec.forEach((v, i) => expect(v).to.equal(inVec[i] * s))
            })

            it("multiplies ND real vector with a scalar", () => {
                const dim = randomInt(5, 64)
                const [inRef, inVec] = randomVector(dim)
                const s = randomNumber()
    
                const outRef = space.f64_vec_scalar_mul(dim, inRef, s)
                const outVec = new Float64Array(mem.stack.buffer, outRef, dim)
    
                outVec.forEach((v, i) => expect(v).to.equal(inVec[i] * s))
            })

        })

        describe("real vector scalar div", () => {

            it("divides 2D real vector by a scalar", () => {
                const [inRef, inVec] = randomVector(2)
                const s = randomNumber(notZero)
    
                const outRef = space.f64_vec2_scalar_div(inRef, s)
                const outVec = new Float64Array(mem.stack.buffer, outRef, 2)
    
                outVec.forEach((v, i) => expect(v).to.equal(inVec[i] / s))
            })

            it("divides 3D real vector by a scalar", () => {
                const [inRef, inVec] = randomVector(3)
                const s = randomNumber(notZero)
    
                const outRef = space.f64_vec3_scalar_div(inRef, s)
                const outVec = new Float64Array(mem.stack.buffer, outRef, 3)
    
                outVec.forEach((v, i) => expect(v).to.equal(inVec[i] / s))
            })

            it("divides 4D real vector by a scalar", () => {
                const [inRef, inVec] = randomVector(4)
                const s = randomNumber(notZero)
    
                const outRef = space.f64_vec4_scalar_div(inRef, s)
                const outVec = new Float64Array(mem.stack.buffer, outRef, 4)
    
                outVec.forEach((v, i) => expect(v).to.equal(inVec[i] / s))
            })

            it("divides ND real vector by a scalar", () => {
                const dim = randomInt(5, 64)
                const [inRef, inVec] = randomVector(dim)
                const s = randomNumber(notZero)
    
                const outRef = space.f64_vec_scalar_div(dim, inRef, s)
                const outVec = new Float64Array(mem.stack.buffer, outRef, dim)
    
                outVec.forEach((v, i) => expect(v).to.equal(inVec[i] / s))
            })

        })

        describe("real vector dot product", () => {

            it("calculates dot product between 2D real vector and another", () => {
                const [ref1, v1] = randomVector(2)
                const [ref2, v2] = randomVector(2)
    
                const result = space.f64_vec2_dot(ref1, ref2)
    
                expect(result).to.equal(dot(v1, v2))
            })

            it("calculates dot product between 3D real vector and another", () => {
                const [ref1, v1] = randomVector(3)
                const [ref2, v2] = randomVector(3)
    
                const result = space.f64_vec3_dot(ref1, ref2)
    
                expect(result).to.equal(dot(v1, v2))
            })

            it("calculates dot product between 4D real vector and another", () => {
                const [ref1, v1] = randomVector(4)
                const [ref2, v2] = randomVector(4)
    
                const result = space.f64_vec4_dot(ref1, ref2)
    
                expect(result).to.equal(dot(v1, v2))
            })

            it("calculates dot product between ND real vector and another", () => {
                const dim = randomInt(5, 64)
                const [ref1, v1] = randomVector(dim)
                const [ref2, v2] = randomVector(dim)
    
                const result = space.f64_vec_dot(dim, ref1, ref2)
    
                expect(result).to.equal(dot(v1, v2))
            })

        })

        describe("real vector length", () => {

            it("calculates length of 2D real vector", () => {
                const [ref, v] = randomVector(2)
    
                const result = space.f64_vec2_length(ref)
    
                expect(result).to.equal(length(v))
            })

            it("calculates length of 3D real vector", () => {
                const [ref, v] = randomVector(3)
    
                const result = space.f64_vec3_length(ref)
    
                expect(result).to.equal(length(v))
            })

            it("calculates length of 4D real vector", () => {
                const [ref, v] = randomVector(4)
    
                const result = space.f64_vec4_length(ref)
    
                expect(result).to.equal(length(v))
            })

            it("calculates length of ND real vector", () => {
                const dim = randomInt(5, 64)
                const [ref, v] = randomVector(dim)
    
                const result = space.f64_vec_length(dim, ref)
    
                expect(result).to.equal(length(v))
            })

        })

        describe("real vector normalization", () => {

            it("normalizes 2D real vector", () => {
                const [inRef, inVec] = randomVector(2, notZero)
                const s = length(inVec)
    
                const outRef = space.f64_vec2_normalize(inRef)
                const outVec = new Float64Array(mem.stack.buffer, outRef, 2)
    
                outVec.forEach((v, i) => expect(v).to.equal(inVec[i] / s))
            })

            it("normalizes 3D real vector", () => {
                const [inRef, inVec] = randomVector(3, notZero)
                const s = length(inVec)
    
                const outRef = space.f64_vec3_normalize(inRef)
                const outVec = new Float64Array(mem.stack.buffer, outRef, 3)
    
                outVec.forEach((v, i) => expect(v).to.equal(inVec[i] / s))
            })

            it("normalizes 4D real vector", () => {
                const [inRef, inVec] = randomVector(4, notZero)
                const s = length(inVec)
    
                const outRef = space.f64_vec4_normalize(inRef)
                const outVec = new Float64Array(mem.stack.buffer, outRef, 4)
    
                outVec.forEach((v, i) => expect(v).to.equal(inVec[i] / s))
            })

            it("normalizes ND real vector", () => {
                const dim = randomInt(5, 64)
                const [inRef, inVec] = randomVector(dim, notZero)
                const s = length(inVec)
    
                const outRef = space.f64_vec_normalize(dim, inRef)
                const outVec = new Float64Array(mem.stack.buffer, outRef, 1)
    
                outVec.forEach((v, i) => expect(v).to.equal(inVec[i] / s))
            })

        })

    })

    function length(v: Float64Array): number {
        return Math.sqrt(dot(v, v))
    }
    
    function dot(v1: Float64Array, v2: Float64Array): number {
        return v1.reduce((p, c1, i) => p + c1 * v2[i], 0)
    }
    
    function randomVector(dim: number, filter: (n: number) => boolean = () => true): [rt.Reference, Float64Array] {
        const ref = mem.allocate64(dim)
        const vector = new Float64Array(mem.stack.buffer, ref, dim)
        randomize(vector, filter)
        return [ref, vector]
    }
    
    function randomize(a: Float64Array, filter: (n: number) => boolean = () => true) {
        for (let i = 0; i < a.length; i++) {
            a[i] = randomNumber(filter)
        }
    }
    
    function randomNumber(filter: (n: number) => boolean = () => true) {
        let n = Math.random()
        while (!filter(n)) {
            n = Math.random()
        }
        return n
    }
    
    function randomInt(min: number = 0, max: number = min + 100): number {
        return Math.round((max - min) * Math.random() + min)
    }
    
    function notNull<T>(value: T | undefined, message: string): T {
        if (!value) {
            throw new Error(message)
        }
        return value
    }

})
