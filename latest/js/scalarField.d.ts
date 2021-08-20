import * as wa from "../../../vibrato.js/latest/js/wa.js";
import * as rt from "../../../vibrato.js/latest/js/rt.js";
import { Vec4 } from "./vector.js";
export declare type ScalarFieldExports = {
    tessellateTetrahedron: (contourValue: number, point0: rt.Reference, point1: rt.Reference, point2: rt.Reference, point3: rt.Reference) => rt.Reference;
    tessellateCube: (contourValue: number, point0: rt.Reference, point1: rt.Reference, point2: rt.Reference, point3: rt.Reference, point4: rt.Reference, point5: rt.Reference, point6: rt.Reference, point7: rt.Reference) => rt.Reference;
    tesselateScalarField(fieldRef: rt.Reference, resolution: number, contourValue: number): rt.Reference;
    sampleScalarField(resolution: number): rt.Reference;
    resampleScalarField(fieldRef: rt.Reference, resolution: number): void;
    interpolatedSample(fieldRef: rt.Reference, resolution: number, x: number, y: number, z: number): rt.Reference;
    nearestSample(fieldRef: rt.Reference, resolution: number, x: number, y: number, z: number): rt.Reference;
};
export declare type SamplerExports = {
    sampleAt: (x: number, y: number, z: number, result: rt.Reference) => void;
};
export declare const modulePaths: {
    mem: string;
    space: string;
    scalarField: string;
};
export declare type ScalarFieldModuleNames = keyof typeof modulePaths;
export declare type ScalarFieldModules = wa.WebAssemblyModules<ScalarFieldModuleNames>;
export declare function loadScalarFieldModule(): Promise<ScalarFieldModule>;
export declare function scalarFieldModule(modules: ScalarFieldModules): ScalarFieldModule;
export declare type ScalarFieldSampler = (x: number, y: number, z: number, w?: number) => Vec4;
export interface ScalarFieldModule {
    readonly modules: ScalarFieldModules;
    newInstance(): ScalarFieldInstance;
}
export interface ScalarFieldInstance {
    readonly mem: rt.MemExports;
    readonly space: rt.SpaceExports;
    readonly scalarField: ScalarFieldExports;
    readonly vertices: Float32Array;
    resolution: number;
    sampler: ScalarFieldSampler;
    contourValue: number;
    get(x: number, y: number, z: number): Vec4;
    getNearest(x: number, y: number, z: number): Vec4;
}
