import * as vec from "./vector.js"

export type Mat<D extends vec.Dim> = vec.Tuple<vec.Vec<D>, D>

export type Mat2 = Mat<2>
export type Mat3 = Mat<3>
export type Mat4 = Mat<4>

export interface MatMath<D extends vec.Dim> {

    of(m: Mat<D>): Mat<D>

    from(array: vec.NumberArray, offset?: number): Mat<D>

    gen(...columns: [() => vec.Vec<D>] | vec.Tuple<() => vec.Vec<D>, D>): () => Mat<D>

    identity(): Mat<D>

    diagonal(...d: vec.Vec<D>): Mat<D>

    outer(v1: vec.Vec<D>, v2: vec.Vec<D>): Mat<D>

    projectionOn(v: vec.Vec<D>): Mat<D>

    apply(m: Mat<D>, v: vec.Vec<D>): vec.Vec<D>

    neg(m: Mat<D>): Mat<D>

    scale(m: Mat<D>, f: number): Mat<D>

    add(m1: Mat<D>, m2: Mat<D>): Mat<D>

    sub(m1: Mat<D>, m2: Mat<D>): Mat<D>

    mul(m1: Mat<D>, m2: Mat<D>): Mat<D>

    determinant(m: Mat<D>): number

    transpose(m: Mat<D>): Mat<D>

    inverse(m: Mat<D>): Mat<D>

    comatrix(m: Mat<D>): Mat<D>

    orthogonal(matrix: Mat<D>, keepScale?: boolean): Mat<D>

    columnMajorArray(m: Mat<D>): number[]

}

export class Mat4Math implements MatMath<4> {

    of(m: Mat4): Mat4 {
        return m
    }

    from(array: vec.NumberArray, offset: number = 0): Mat4 {
        return [
            vec.vec4.from(array, offset),
            vec.vec4.from(array, offset + 4),
            vec.vec4.from(array, offset + 8),
            vec.vec4.from(array, offset + 12),
        ]
    }

    gen(...columns: [() => vec.Vec4] | vec.Tuple<() => vec.Vec4, 4>): () => Mat4 {
        const column = columns[0]
        return columns.length == 1 ?
            () => [column(), column(), column(), column()] :
            () => [columns[0](), columns[1](), columns[2](), columns[3]()]
    }

    identity(): Mat4 {
        return this.diagonal(1, 1, 1, 1)
    }

    diagonal(...d: vec.Vec4): Mat4 {
        return [
            [d[0],    0,    0,    0],
            [   0, d[1],    0,    0],
            [   0,    0, d[2],    0],
            [   0,    0,    0, d[3]]
        ]
    }

    outer(v1: vec.Vec4, v2: vec.Vec4): Mat4 {
        return [
            vec.vec4.scale(v1, v2[0]),
            vec.vec4.scale(v1, v2[1]),
            vec.vec4.scale(v1, v2[2]),
            vec.vec4.scale(v1, v2[3])
        ]
    }

    projectionOn(v: vec.Vec4): Mat4 {
        return this.scale(this.outer(v, v), 1 / vec.vec4.lengthSquared(v))
    }

    scalingAlong(v: vec.Vec3, parallel: number = 1, perpendicular: number = 1): Mat4 {
        return this.cast(mat3.scalingAlong(v, parallel, perpendicular))
    }

    scaling(...diagonal: vec.Vec3): Mat4 {
        return this.diagonal(...diagonal, 1)
    }

    translation(t: vec.Vec3): Mat4 {
        return [
            [1, 0, 0, 0],
            [0, 1, 0, 0],
            [0, 0, 1, 0],
            [   ...t, 1]
        ]
    }

    rotationX(angle: number): Mat4 {
        const cos = Math.cos(angle);
        const sin = Math.sin(angle);
        return [
            [1,    0,    0, 0],
            [0, +cos, +sin, 0],
            [0, -sin, +cos, 0],
            [0,    0,    0, 1]
        ]
    }

    rotationY(angle: number): Mat4 {
        const cos = Math.cos(angle);
        const sin = Math.sin(angle);
        return [
            [+cos, 0, -sin, 0],
            [   0, 1,    0, 0],
            [+sin, 0, +cos, 0],
            [   0, 0,    0, 1]
        ]
    }

    rotationZ(angle: number): Mat4 {
        const cos = Math.cos(angle);
        const sin = Math.sin(angle);
        return [
            [+cos, +sin, 0, 0],
            [-sin, +cos, 0, 0],
            [   0,    0, 1, 0],
            [   0,    0, 0, 1]
        ]
    }

    rotation(angle: number, axis: vec.Vec3): Mat4 {
        return this.cast(mat3.rotation(angle, axis))
    }

    crossProdRotation(v1: vec.Vec3, v2: vec.Vec3, power: number = 1): Mat4 {
        return this.cast(mat3.crossProdRotation(v1, v2, power))
    }

    lookTowards(pos: vec.Vec3, dir: vec.Vec3 = [0, 0, -1], up: vec.Vec3 = [0, 1, 0]): Mat4 {
        const r = mat3.lookTowards(dir, up)
        const p = mat3.apply(r, vec.vec3.neg(pos))
        return this.affine(r, p)
    }

    lookAt(pos: vec.Vec3, objPos: vec.Vec3 = [0, 0, 0], up: vec.Vec3 = [0, 1, 0]) {
        const dir = vec.vec3.sub(objPos, pos);
        return this.lookTowards(pos, dir, up);
    }
    
    projection(zoom: number = 1, near: number = 1, far: number = 128 * near, aspectRatio = 1): Mat4 {
        const range = far - near
        return [
            [zoom / aspectRatio,    0,                        0,  0],
            [                 0, zoom,                        0,  0],
            [                 0,    0,    -(near + far) / range, -1],
            [                 0,    0, -2 * near * far  / range,  0]
        ];
    }

    translated(m: Mat3, t: vec.Vec3): Mat4 {
        const newT = vec.vec3.sub(t, mat3.apply(m, t))
        return this.affine(m, newT)
    }

    affine(m: Mat3, t: vec.Vec3): Mat4 {
        return [
            [...m[0], 0],
            [...m[1], 0],
            [...m[2], 0],
            [   ...t, 1]
        ]
    }

    cast(m: Mat2 | Mat3): Mat4 {
        return m.length == 2 ? [
            [...m[0], 0, 0],
            [...m[1], 0, 0],
            [0,    0, 1, 0],
            [0,    0, 0, 1],
        ] : [
            [...m[0], 0],
            [...m[1], 0],
            [...m[2], 0],
            [0, 0, 0, 1]
        ]
    }

    apply(m: Mat4, v: vec.Vec4): vec.Vec4 {
        return vec.vec4.addAll(
            vec.vec4.scale(m[0], v[0]),
            vec.vec4.scale(m[1], v[1]),
            vec.vec4.scale(m[2], v[2]),
            vec.vec4.scale(m[3], v[3])
        )
    }

    neg(m: Mat4): Mat4 {
        return [
            vec.vec4.neg(m[0]),
            vec.vec4.neg(m[1]),
            vec.vec4.neg(m[2]),
            vec.vec4.neg(m[3])
        ]
    }

    scale(m: Mat4, f: number): Mat4 {
        return [
            vec.vec4.scale(m[0], f),
            vec.vec4.scale(m[1], f),
            vec.vec4.scale(m[2], f),
            vec.vec4.scale(m[3], f)
        ]
    }

    add(m1: Mat4, m2: Mat4): Mat4 {
        return [
            vec.vec4.add(m1[0], m2[0]),
            vec.vec4.add(m1[1], m2[1]),
            vec.vec4.add(m1[2], m2[2]),
            vec.vec4.add(m1[3], m2[3])
        ]
    }

    sub(m1: Mat4, m2: Mat4): Mat4 {
        return [
            vec.vec4.sub(m1[0], m2[0]),
            vec.vec4.sub(m1[1], m2[1]),
            vec.vec4.sub(m1[2], m2[2]),
            vec.vec4.sub(m1[3], m2[3])
        ]
    }

    mul(m1: Mat4, m2: Mat4): Mat4 {
        return [
            this.apply(m1, m2[0]),
            this.apply(m1, m2[1]),
            this.apply(m1, m2[2]),
            this.apply(m1, m2[3])
        ]
    }

    determinant(m: Mat4): number {
        const col0 = m[0]
        return (
            col0[0] * this.minor(m, 0, 0) -
            col0[1] * this.minor(m, 0, 1) +
            col0[2] * this.minor(m, 0, 2) -
            col0[3] * this.minor(m, 0, 3)
        ) 
    }

    transpose(m: Mat4): Mat4 {
        return [
            [m[0][0], m[1][0], m[2][0], m[3][0]],
            [m[0][1], m[1][1], m[2][1], m[3][1]],
            [m[0][2], m[1][2], m[2][2], m[3][2]],
            [m[0][3], m[1][3], m[2][3], m[3][3]]
        ]
    }

    inverse(m: Mat4): Mat4 {
        const min00 = this.minor(m, 0, 0)
        const min01 = this.minor(m, 0, 1)
        const min02 = this.minor(m, 0, 2)
        const min03 = this.minor(m, 0, 3)
        const col0 = m[0]
        const det = (
            col0[0] * min00 -
            col0[1] * min01 +
            col0[2] * min02 -
            col0[3] * min03
        )
        return this.scale([
            [+min00, -this.minor(m, 1, 0), +this.minor(m, 2, 0), -this.minor(m, 3, 0)],
            [-min01, +this.minor(m, 1, 1), -this.minor(m, 2, 1), +this.minor(m, 3, 1)],
            [+min02, -this.minor(m, 1, 2), +this.minor(m, 2, 2), -this.minor(m, 3, 2)],
            [-min03, +this.minor(m, 1, 3), -this.minor(m, 2, 3), +this.minor(m, 3, 3)]
        ], 1 / det)
    }

    comatrix(m: Mat4): Mat4 {
        return [[
            +this.minor(m, 0, 0),
            -this.minor(m, 0, 1),
            +this.minor(m, 0, 2),
            -this.minor(m, 0, 3),
        ], [
            -this.minor(m, 1, 0),
            +this.minor(m, 1, 1),
            -this.minor(m, 1, 2),
            +this.minor(m, 1, 3),            
        ], [
            +this.minor(m, 2, 0),
            -this.minor(m, 2, 1),
            +this.minor(m, 2, 2),
            -this.minor(m, 2, 3),
        ], [
            -this.minor(m, 3, 0),
            +this.minor(m, 3, 1),
            -this.minor(m, 3, 2),
            +this.minor(m, 3, 3),
        ]]
    }

    orthogonal(matrix: Mat4, keepScale?: boolean): Mat4 {
        const s = keepScale ? this.determinant(matrix) ** (1 / 3) : 1
        const x = vec.vec4.withLength(s, matrix[0]);
        const y = vec.vec4.withLength(s, vec.vec4.subAll(matrix[1], vec.vec4.project(matrix[1], x)));
        const z = vec.vec4.withLength(s, vec.vec4.subAll(matrix[2], vec.vec4.project(matrix[2], x), vec.vec4.project(matrix[2], y)));
        return [x, y, z, matrix[3]];
    }

    columnMajorArray(m: Mat4): number[] {
        return [
            ...m[0],
            ...m[1],
            ...m[2],
            ...m[3]
        ]
    }

    private minor(m: Mat4, col: vec.Component<4>, row: vec.Component<4>): number {
        return mat3.determinant(this.subMat(m, col, row))
    }

    private subMat(m: Mat4, col: vec.Component<4>, row: vec.Component<4>): Mat3 {
        const m3x4 = vec.deleteComponent<vec.Vec4, 4>(m, col)
        return [
            vec.deleteComponent<number, 4>(m3x4[0], row),
            vec.deleteComponent<number, 4>(m3x4[1], row),
            vec.deleteComponent<number, 4>(m3x4[2], row)
        ]
    }

}

export class Mat3Math implements MatMath<3> {

    of(m: Mat3): Mat3 {
        return m
    }

    from(array: vec.NumberArray, offset = 0): Mat3 {
        return [
            vec.vec3.from(array, offset),
            vec.vec3.from(array, offset + 3),
            vec.vec3.from(array, offset + 6),
        ]
    }

    gen(...columns: [() => vec.Vec3] | vec.Tuple<() => vec.Vec3, 3>): () => Mat3 {
        const column = columns[0]
        return columns.length == 1 ?
            () => [column(), column(), column()] :
            () => [columns[0](), columns[1](), columns[2]()]
    }

    identity(): Mat3 {
        return this.diagonal(1, 1, 1)
    }

    diagonal(...d: vec.Vec3): Mat3 {
        return [
            [d[0],    0,    0],
            [   0, d[1],    0],
            [   0,    0, d[2]]
        ]
    }

    outer(v1: vec.Vec3, v2: vec.Vec3): Mat3 {
        return [
            vec.vec3.scale(v1, v2[0]),
            vec.vec3.scale(v1, v2[1]),
            vec.vec3.scale(v1, v2[2])
        ]
    }

    projectionOn(v: vec.Vec3): Mat3 {
        return this.scale(this.outer(v, v), 1 / vec.vec3.lengthSquared(v))
    }

    scalingAlong(v: vec.Vec3, parallel: number = 1, perpendicular: number = 1): Mat3 {
        if (parallel === perpendicular) {
            return this.diagonal(parallel, parallel, parallel)
        }
        const parallelProj = this.projectionOn(v)
        const perpendicularProj = this.sub(this.identity(), this.projectionOn(v))
        return this.add(
            parallel === 1 ? parallelProj : this.scale(parallelProj, parallel),
            perpendicular === 1 ? perpendicularProj : this.scale(perpendicularProj, perpendicular)
        )
    }

    scaling(...diagonal: vec.Vec3): Mat3 {
        return this.diagonal(...diagonal)
    }

    rotationX(angle: number): Mat3 {
        const cos = Math.cos(angle);
        const sin = Math.sin(angle);
        return [
            [1,    0,    0],
            [0, +cos, +sin],
            [0, -sin, +cos]
        ]
    }

    rotationY(angle: number): Mat3 {
        const cos = Math.cos(angle);
        const sin = Math.sin(angle);
        return [
            [+cos, 0, -sin],
            [   0, 1,    0],
            [+sin, 0, +cos]
        ]
    }

    rotationZ(angle: number): Mat3 {
        const cos = Math.cos(angle);
        const sin = Math.sin(angle);
        return [
            [+cos, +sin, 0],
            [-sin, +cos, 0],
            [   0,    0, 1]
        ]
    }

    rotation(angle: number, axis: vec.Vec3): Mat3 {
        const unitAxis = vec.vec3.unit(axis)
        const cos = Math.cos(angle)
        const sin = Math.sin(angle)
        return this.rotMat(cos, sin, ...unitAxis)
    }

    crossProdRotation(v1: vec.Vec3, v2: vec.Vec3, power: number = 1): Mat3 {
        const u1 = vec.vec3.unit(v1)
        const u2 = vec.vec3.unit(v2)
        const axis = vec.vec3.cross(u1, u2)
        const cos = vec.vec3.dot(u1, u2)
        const sin = vec.vec3.length(axis)
        if (power === 1) {
            const unitAxis = vec.vec3.scale(axis, 1 / sin)
            return this.rotMat(cos, sin, ...unitAxis)
        } else {
            const newAngle = power * Math.atan2(sin, cos)
            return this.rotation(newAngle, axis)
        }
    }

    private rotMat(cos: number, sin: number, x: number, y: number, z: number): Mat3 {
        if (Number.isNaN(cos + sin + x + y + z)) {
            return this.identity()
        }
        const oneMinusCos = 1 - cos
        const x1 = x * oneMinusCos
        const y1 = y * oneMinusCos
        const z1 = z * oneMinusCos
        const xx = x * x1
        const yy = y * y1
        const zz = z * z1
        const xy = x * y1
        const yz = y * z1
        const zx = z * x1
        return [
            [xx + cos, xy + z * sin, zx - y * sin],
            [xy - z * sin, yy + cos, yz + x * sin],
            [zx + y * sin, yz - x * sin, zz + cos]
        ]
    }


    lookTowards(dir: vec.Vec3, up: vec.Vec3 = [0, 1, 0]): Mat3 {
        const z = vec.vec3.unit(vec.vec3.neg(dir))
        const x = vec.vec3.unit(vec.vec3.cross(up, z))
        const y = vec.vec3.cross(z, x)
        return this.transpose([x, y, z])
    }

    cast(m: Mat2): Mat3 {
        return [
            [...m[0], 0],
            [...m[1], 0],
            [0,    0, 1]
        ]
    }

    apply(m: Mat3, v: vec.Vec3): vec.Vec3 {
        return vec.vec3.addAll(
            vec.vec3.scale(m[0], v[0]),
            vec.vec3.scale(m[1], v[1]),
            vec.vec3.scale(m[2], v[2])
        )
    }

    neg(m: Mat3): Mat3 {
        return [
            vec.vec3.neg(m[0]),
            vec.vec3.neg(m[1]),
            vec.vec3.neg(m[2])
        ]
    }

    scale(m: Mat3, f: number): Mat3 {
        return [
            vec.vec3.scale(m[0], f),
            vec.vec3.scale(m[1], f),
            vec.vec3.scale(m[2], f)
        ]
    }

    add(m1: Mat3, m2: Mat3): Mat3 {
        return [
            vec.vec3.add(m1[0], m2[0]),
            vec.vec3.add(m1[1], m2[1]),
            vec.vec3.add(m1[2], m2[2])
        ]
    }

    sub(m1: Mat3, m2: Mat3): Mat3 {
        return [
            vec.vec3.sub(m1[0], m2[0]),
            vec.vec3.sub(m1[1], m2[1]),
            vec.vec3.sub(m1[2], m2[2])
        ]
    }

    mul(m1: Mat3, m2: Mat3): Mat3 {
        return [
            this.apply(m1, m2[0]),
            this.apply(m1, m2[1]),
            this.apply(m1, m2[2])
        ]
    }

    determinant(m: Mat3): number {
        return vec.vec3.dot(vec.vec3.cross(m[0], m[1]), m[2])
    }

    transpose(m: Mat3): Mat3 {
        return [
            [m[0][0], m[1][0], m[2][0]],
            [m[0][1], m[1][1], m[2][1]],
            [m[0][2], m[1][2], m[2][2]]
        ]
    }

    inverse(m: Mat3): Mat3 {
        const coM = this.comatrix(m)
        const det = vec.vec3.dot(coM[0], m[0])
        return this.scale(this.transpose(coM), 1 / det)
    }

    comatrix(m: Mat3): Mat3 {
        return [
            vec.vec3.cross(m[1], m[2]),
            vec.vec3.cross(m[2], m[0]),
            vec.vec3.cross(m[0], m[1]),
        ]
    }

    orthogonal(matrix: Mat3, keepScale?: boolean): Mat3 {
        const s = keepScale ? this.determinant(matrix) ** (1 / 3) : 1
        const x = vec.vec3.withLength(s, matrix[0]);
        const y = vec.vec3.withLength(s, vec.vec3.subAll(matrix[1], vec.vec3.project(matrix[1], x)));
        const z = vec.vec3.withLength(s, vec.vec3.subAll(matrix[2], vec.vec3.project(matrix[2], x), vec.vec3.project(matrix[2], y)));
        return [x, y, z];
    }

    columnMajorArray(m: Mat3): number[] {
        return [
            ...m[0],
            ...m[1],
            ...m[2]
        ]
    }

}

export class Mat2Math implements MatMath<2> {

    of(m: Mat2): Mat2 {
        return m
    }

    from(array: vec.NumberArray, offset = 0): Mat2 {
        return [
            vec.vec2.from(array, offset),
            vec.vec2.from(array, offset + 2),
        ]
    }

    gen(...columns: [() => vec.Vec2] | vec.Tuple<() => vec.Vec2, 2>): () => Mat2 {
        const column = columns[0]
        return columns.length == 1 ?
            () => [column(), column()] :
            () => [columns[0](), columns[1]()]
    }

    identity(): Mat2 {
        return this.diagonal(1, 1)
    }

    diagonal(...d: vec.Vec2): Mat2 {
        return [
            [d[0],    0],
            [   0, d[1]]
        ]
    }

    outer(v1: vec.Vec2, v2: vec.Vec2): Mat2 {
        return [
            vec.vec2.scale(v1, v2[0]),
            vec.vec2.scale(v1, v2[1])
        ]
    }

    projectionOn(v: vec.Vec2): Mat2 {
        return this.scale(this.outer(v, v), 1 / vec.vec2.lengthSquared(v))
    }

    scalingAlong(v: vec.Vec2, parallel: number = 1, perpendicular: number = 1): Mat2 {
        if (parallel === perpendicular) {
            return this.diagonal(parallel, parallel)
        }
        const parallelProj = this.projectionOn(v)
        const perpendicularProj = this.sub(this.identity(), this.projectionOn(v))
        return this.add(
            parallel === 1 ? parallelProj : this.scale(parallelProj, parallel),
            perpendicular === 1 ? perpendicularProj : this.scale(perpendicularProj, perpendicular)
        )
    }

    scaling(...diagonal: vec.Vec2): Mat2 {
        return this.diagonal(...diagonal)
    }

    rotation(angle: number): Mat2 {
        const cos = Math.cos(angle);
        const sin = Math.sin(angle);
        return [
            [+cos, +sin],
            [-sin, +cos]
        ]
    }

    apply(m: Mat2, v: vec.Vec2): vec.Vec2 {
        return vec.vec2.add(
            vec.vec2.scale(m[0], v[0]),
            vec.vec2.scale(m[1], v[1])
        )
    }

    neg(m: Mat2): Mat2 {
        return [
            vec.vec2.neg(m[0]),
            vec.vec2.neg(m[1])
        ]
    }

    scale(m: Mat2, f: number): Mat2 {
        return [
            vec.vec2.scale(m[0], f),
            vec.vec2.scale(m[1], f)
        ]
    }

    add(m1: Mat2, m2: Mat2): Mat2 {
        return [
            vec.vec2.add(m1[0], m2[0]),
            vec.vec2.add(m1[1], m2[1])
        ]
    }

    sub(m1: Mat2, m2: Mat2): Mat2 {
        return [
            vec.vec2.sub(m1[0], m2[0]),
            vec.vec2.sub(m1[1], m2[1])
        ]
    }

    mul(m1: Mat2, m2: Mat2): Mat2 {
        return [
            this.apply(m1, m2[0]),
            this.apply(m1, m2[1])
        ]
    }

    determinant(m: Mat2): number {
        return vec.vec2.cross(m[0], m[1])
    }

    transpose(m: Mat2): Mat2 {
        return [
            [m[0][0], m[1][0]],
            [m[0][1], m[1][1]]
        ]
    }

    inverse(m: Mat2): Mat2 {
        return this.scale(
            [
                [+m[1][1], -m[0][1]],
                [-m[1][0], +m[0][0]],
            ], 
            1 / this.determinant(m)
        )
    }

    comatrix(m: Mat2): Mat2 {
        return [
            [+m[1][1], -m[1][0]],
            [-m[0][1], +m[0][0]],
        ]
    }
    
    orthogonal(matrix: Mat2, keepScale?: boolean): Mat2 {
        const s = keepScale ? Math.sqrt(this.determinant(matrix)) : 1
        const x = vec.vec2.withLength(s, matrix[0]);
        const y = vec.vec2.withLength(s, vec.vec2.subAll(matrix[1], vec.vec2.project(matrix[1], x)));
        return [x, y];
    }

    columnMajorArray(m: Mat2): number[] {
        return [
            ...m[0],
            ...m[1]
        ]
    }

}

export function coordinateSystem<D extends vec.Dim>(math: MatMath<D>, s: Mat<D>): (m: Mat<D>) => Mat<D> {
    const invS = math.inverse(s)
    return m => math.mul(s, math.mul(m, invS))
}

export function isIdentity<D extends vec.Dim>(m: Mat<D>): boolean {
    const dim = m.length
    for (let i = 0; i < dim; i++) {
        for (let j = i; j < dim; j++) {
            if (i === j) {
                if (m[i][j] !== 1) {
                    return false
                }
            } else {
                if (m[i][j] !== 0 || m[j][i] !== 0) {
                    return false
                }
            }
        }
    }
    return true
}

export const mat4 = new Mat4Math()
export const mat3 = new Mat3Math()
export const mat2 = new Mat2Math()
