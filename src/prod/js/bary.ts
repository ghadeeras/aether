import * as vec from "./vector.js"
import * as mat from "./matrix.js"

export class Bary {

    private translation: vec.Vec3
    private fromCartesianMat: mat.Mat3
    private toCartesianMat: mat.Mat3

    constructor(public readonly v1: vec.Vec3, public readonly v2: vec.Vec3, public readonly v3: vec.Vec3, unit: number = 1) {
        const areaVec = vec.vec3.cross(vec.vec3.sub(v2, v1), vec.vec3.sub(v3, v1))
        const areaSquared = vec.vec3.lengthSquared(areaVec)
        if (areaSquared === 0) {
            throw new Error(`${v1}, ${v2}, ${v3} are collinear`)
        }
        const d = vec.vec3.dot(areaVec, v1) // distance from the plane to the origin times the area of the triangle
        const area = Math.sqrt(areaSquared)
        this.translation = vec.vec3.scale(areaVec, (unit * area - d) / areaSquared) // translation from the plane to one unit away from the origin
        this.toCartesianMat = [
            vec.vec3.add(v1, this.translation), 
            vec.vec3.add(v2, this.translation), 
            vec.vec3.add(v3, this.translation),
        ]
        this.fromCartesianMat = mat.mat3.inverse(this.toCartesianMat)
    }

    toCartesian(b: vec.Vec3): vec.Vec3 {
        return vec.vec3.sub(
            mat.mat3.apply(this.toCartesianMat, b), 
            this.translation
        )
    }

    fromCartesian(v: vec.Vec3): vec.Vec3 {
        return mat.mat3.apply(
            this.fromCartesianMat, 
            vec.vec3.add(v, this.translation)
        )
    }

}