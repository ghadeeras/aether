var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
import * as wa from "../../../vibrato.js/latest/js/wa.js";
import { vec4 } from "./vector.js";
export const modulePaths = {
    mem: "vibrato.js/latest/wa/mem.wasm",
    space: "vibrato.js/latest/wa/space.wasm",
    scalarField: "aether/latest/wa/scalarField.wasm",
};
export function loadScalarFieldModule() {
    return __awaiter(this, void 0, void 0, function* () {
        const modules = yield wa.webLoadModules("", modulePaths);
        return scalarFieldModule(modules);
    });
}
export function scalarFieldModule(modules) {
    return new ScalarFieldModuleImpl(modules);
}
class ScalarFieldModuleImpl {
    constructor(modules) {
        this.modules = modules;
        this.linker = new wa.Linker(modules);
    }
    newInstance() {
        const samplerProxy = {
            sampleAt: () => {
                throw new Error("Unimplemented!");
            }
        };
        const instances = this.linker.link({
            sampler: {
                exports: {
                    sampleAt: function (x, y, z, result) {
                        samplerProxy.sampleAt(x, y, z, result);
                    }
                }
            }
        });
        return new ScalarFieldInstanceImpl(samplerProxy, instances.mem.exports, instances.space.exports, instances.scalarField.exports);
    }
}
class ScalarFieldInstanceImpl {
    constructor(samplerProxy, mem, space, scalarField) {
        this.samplerProxy = samplerProxy;
        this.mem = mem;
        this.space = space;
        this.scalarField = scalarField;
        this.fieldRef = 0;
        this.resolutionDirty = false;
        this.samplingDirty = false;
        this.verticesDirty = false;
        this._vertices = new Float32Array([]);
        this._contourValue = 0;
        this._resolution = 1;
        this._sampler = (x, y, z) => vec4.of(x, y, z, (x * x + y * y + z * z) / 2);
        this._lastMemSize = 0;
        this._view64 = new Float64Array();
        this.mem.enter();
        this.mem.enter();
        this.invalidateResolution();
    }
    get view64() {
        if (this._lastMemSize != this.mem.stack.buffer.byteLength) {
            this._lastMemSize = this.mem.stack.buffer.byteLength;
            this._view64 = new Float64Array(this.mem.stack.buffer);
        }
        return this._view64;
    }
    get resolution() {
        return this._resolution;
    }
    set resolution(r) {
        this._resolution = r;
        this.invalidateResolution();
    }
    get sampler() {
        return this._sampler;
    }
    set sampler(s) {
        this._sampler = s;
        this.samplerProxy.sampleAt = (x, y, z, result) => {
            const vec = s(x, y, z);
            this.space.f64_vec4_r(...vec, result);
        };
        this.invalidateSampling();
    }
    get contourValue() {
        return this._contourValue;
    }
    set contourValue(r) {
        this._contourValue = r;
        this.invalidateVertices();
    }
    get vertices() {
        this.doTesselate();
        return this._vertices;
    }
    get(x, y, z) {
        this.doSample();
        const v = this.view64;
        this.mem.enter();
        const i = this.scalarField.interpolatedSample(this.fieldRef, this.resolution, x, y, z) / v.BYTES_PER_ELEMENT;
        const result = vec4.of(v[i], v[i + 1], v[i + 2], v[i + 3]);
        this.mem.leave();
        return result;
    }
    getNearest(x, y, z) {
        this.doSample();
        const v = this.view64;
        this.mem.enter();
        const i = this.scalarField.nearestSample(this.fieldRef, this.resolution, x, y, z) / v.BYTES_PER_ELEMENT;
        const result = vec4.of(v[i], v[i + 1], v[i + 2], v[i + 3]);
        this.mem.leave();
        return result;
    }
    invalidateResolution() {
        if (this.resolutionDirty) {
            return;
        }
        this.invalidateSampling();
        this.mem.leave();
        this.resolutionDirty = true;
    }
    invalidateSampling() {
        if (this.samplingDirty) {
            return;
        }
        this.invalidateVertices();
        this.samplingDirty = true;
    }
    invalidateVertices() {
        if (this.verticesDirty) {
            return;
        }
        this.mem.leave();
        this.verticesDirty = true;
    }
    doTesselate() {
        this.doSample();
        if (!this.verticesDirty) {
            return;
        }
        this.mem.enter();
        const start = this.scalarField.tesselateScalarField(this.fieldRef, this._resolution, this._contourValue);
        const end = this.mem.allocate32(0);
        this._vertices = new Float32Array(this.mem.stack.buffer, start, (end - start) / Float32Array.BYTES_PER_ELEMENT);
        this.verticesDirty = false;
    }
    doSample() {
        if (!this.samplingDirty) {
            return;
        }
        if (this.resolutionDirty) {
            this.mem.enter();
            this.fieldRef = this.scalarField.sampleScalarField(this._resolution);
            this.resolutionDirty = false;
        }
        else {
            this.scalarField.resampleScalarField(this.fieldRef, this._resolution);
        }
        this.samplingDirty = false;
    }
}
