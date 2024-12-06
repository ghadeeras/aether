
import { rt, wa } from "vibrato.js/core";
import { vec4, Vec4 } from "./vector.js"

export type ScalarFieldExports = {
    tessellateTetrahedron: (contourValue: number, point0: rt.Reference, point1: rt.Reference, point2: rt.Reference, point3: rt.Reference) => rt.Reference;
    tessellateCube: (contourValue: number, point0: rt.Reference, point1: rt.Reference, point2: rt.Reference, point3: rt.Reference, point4: rt.Reference, point5: rt.Reference, point6: rt.Reference, point7: rt.Reference) => rt.Reference;
    tesselateScalarField(fieldRef: rt.Reference, resolution: number, contourValue: number): rt.Reference;
    sampleScalarField(resolution: number): rt.Reference;
    resampleScalarField(fieldRef: rt.Reference, resolution: number): void;
    interpolatedSample(fieldRef: rt.Reference, resolution: number, x: number, y: number, z:number): rt.Reference
    nearestSample(fieldRef: rt.Reference, resolution: number, x: number, y: number, z:number): rt.Reference
}

export type SamplerExports = {
    sampleAt: (x: number, y: number, z: number, result: rt.Reference) => void
}

export const modulePaths = {
    scalarField: "scalarField.wasm",
}

export type ScalarFieldModuleNames = keyof typeof modulePaths
export type ScalarFieldModules = wa.WebAssemblyModules<ScalarFieldModuleNames>

export async function loadScalarFieldModule(): Promise<ScalarFieldModule> {
    const modules = await wa.webLoadModules(import.meta.url + "/../../wa", modulePaths)
    return scalarFieldModule(modules, await rt.runtime())
}

export function scalarFieldModule(modules: ScalarFieldModules, rtModules: rt.Runtime): ScalarFieldModule {
    return new ScalarFieldModuleImpl(modules, rtModules)
}

export type ScalarFieldSampler = (x: number, y: number, z: number, w?: number) => Vec4

export interface ScalarFieldModule {

    readonly modules: ScalarFieldModules

    newInstance(): ScalarFieldInstance

}

export interface ScalarFieldInstance {

    readonly mem: rt.MemExports
    readonly space: rt.SpaceExports
    readonly scalarField: ScalarFieldExports

    readonly vertices: Float32Array;

    resolution: number
    sampler: ScalarFieldSampler
    contourValue: number

    get(x: number, y: number, z: number): Vec4
    getNearest(x: number, y: number, z: number): Vec4

}

class ScalarFieldModuleImpl implements ScalarFieldModule {

    private linker: wa.Linker<ScalarFieldModuleNames | Exclude<rt.RuntimeModuleNames, "delay">>

    constructor(readonly modules: ScalarFieldModules, private rtModules: rt.Runtime) {
        this.linker = new wa.Linker({
            rawMem: rtModules.modules.rawMem,
            mem: rtModules.modules.mem,
            space: rtModules.modules.space,
            ...modules
        })
    }

    newInstance(): ScalarFieldInstance {
        const samplerProxy: SamplerExports = {
            sampleAt: () => {
                throw new Error("Unimplemented!")
            }
        }
        const instances = this.linker.link({
            sampler: {
                exports: {
                    sampleAt: function(x: number, y: number, z: number, result: rt.Reference) {
                        samplerProxy.sampleAt(x, y, z, result)
                    }
                }
            }
        })
        return new ScalarFieldInstanceImpl(
            samplerProxy,
            instances.mem.exports as rt.MemExports, 
            instances.space.exports as rt.SpaceExports, 
            instances.scalarField.exports as ScalarFieldExports
        )
    }
    
}

class ScalarFieldInstanceImpl implements ScalarFieldInstance {

    private fieldRef: number = 0
    
    private resolutionDirty: boolean = false
    private samplingDirty: boolean = false
    private verticesDirty: boolean = false

    private _vertices: Float32Array = new Float32Array([])

    private _contourValue: number = 0
    private _resolution: number = 1
    private _sampler: ScalarFieldSampler = (x, y, z) => vec4.of(x, y, z, (x * x + y * y + z * z) / 2)

    private _lastMemSize: number = 0
    private _view64: Float64Array = new Float64Array()

    constructor(private samplerProxy: SamplerExports, readonly mem: rt.MemExports, readonly space: rt.SpaceExports, readonly scalarField: ScalarFieldExports) {
        this.mem.enter()
        this.mem.enter()
        this.invalidateResolution()
    }

    get view64(): Float64Array {
        if (this._lastMemSize != this.mem.stack.buffer.byteLength) {
            this._lastMemSize = this.mem.stack.buffer.byteLength
            this._view64 = new Float64Array(this.mem.stack.buffer)
        }
        return this._view64
    }
    
    get resolution(): number {
        return this._resolution
    }

    set resolution(r: number) {
        this._resolution = r
        this.invalidateResolution()
    }

    get sampler(): ScalarFieldSampler {
        return this._sampler
    }

    set sampler(s: ScalarFieldSampler) {
        this._sampler = s
        this.samplerProxy.sampleAt = (x, y, z, result) => {
            const vec = s(x, y, z)
            this.space.f64_vec4_r(...vec, result)
        }
        this.invalidateSampling()
    }

    get contourValue(): number {
        return this._contourValue
    }

    set contourValue(r: number) {
        this._contourValue = r
        this.invalidateVertices()
    }

    get vertices(): Float32Array {
        this.doTesselate()
        return this._vertices
    }

    get(x: number, y: number, z: number): Vec4 {
        this.doSample()
        const v = this.view64
        this.mem.enter()
        const i = this.scalarField.interpolatedSample(this.fieldRef, this.resolution, x, y, z) / v.BYTES_PER_ELEMENT
        const result = vec4.of(v[i], v[i + 1], v[i + 2], v[i + 3])
        this.mem.leave()
        return result
    }

    getNearest(x: number, y: number, z: number): Vec4 {
        this.doSample()
        const v = this.view64
        this.mem.enter()
        const i = this.scalarField.nearestSample(this.fieldRef, this.resolution, x, y, z) / v.BYTES_PER_ELEMENT
        const result = vec4.of(v[i], v[i + 1], v[i + 2], v[i + 3])
        this.mem.leave()
        return result
    }

    private invalidateResolution() {
        if (this.resolutionDirty) {
            return
        }

        this.invalidateSampling()

        this.mem.leave()
        this.resolutionDirty = true
    }

    private invalidateSampling() {
        if (this.samplingDirty) {
            return
        }

        this.invalidateVertices()

        this.samplingDirty = true
    }

    private invalidateVertices() {
        if (this.verticesDirty) {
            return
        }

        this.mem.leave()
        this.verticesDirty = true
    }

    private doTesselate() {
        this.doSample()
        if (!this.verticesDirty) {
            return
        }
        this.mem.enter()
        const start = this.scalarField.tesselateScalarField(this.fieldRef, this._resolution, this._contourValue)
        const end = this.mem.allocate32(0)
        this._vertices = new Float32Array(this.mem.stack.buffer, start, (end - start) / Float32Array.BYTES_PER_ELEMENT)
        this.verticesDirty = false
    }

    private doSample() {
        if (!this.samplingDirty) {
            return
        }
        if (this.resolutionDirty) {
            this.mem.enter()
            this.fieldRef = this.scalarField.sampleScalarField(this._resolution)
            this.resolutionDirty = false
        } else {
            this.scalarField.resampleScalarField(this.fieldRef, this._resolution)
        }
        this.samplingDirty = false
    }

} 
