export class Hasher {

    private _hash = 0

    constructor(private a: number = 11, private b: number = 13, private c: number = 17) {}

    private addInt(i: number) {
        this._hash = (this._hash * this.a + i * this.b + this.c) & 0xFFFFFFFF
    }

    add(buffer: ArrayBuffer): Hasher {
        const a = new Uint8Array(buffer)
        for (const i of a) {
            this.addInt(i)
        }
        return this
    }

    addBoolean(b: boolean) {
        this.addInt(b ? 1 : 0)
        return this
    }

    addNumbers(...ns: number[]) {
        const array = new Float64Array(ns)
        return this.add(array.buffer)
    }

    addNumber(n: number) {
        const array = new Float64Array(1)
        array[0] = n
        return this.add(array.buffer)
    }

    addString(s: string): Hasher {
        return this.add(new Uint32Array([...s].map(c => c.codePointAt(0) ?? 0)).buffer)
    }

    get hash():  number {
        return this._hash
    }

}

export function hash<const H extends Hashable>(value: H): number {
    return doHash(value)
}

export function doHash<const H extends Hashable>(value: H, hasher: Hasher = new Hasher()): number {
    if (value instanceof Array) {
        for (const v of value) {
            doHash(v, hasher)
        }
        return hasher.hash
    }
    switch (typeof value) {
        case "boolean": return hasher.addBoolean(value).hash
        case "number" : return hasher.addNumber(value).hash
        case "string" : return hasher.addString(value).hash
        case "object" : {
            if ("hash" in value && typeof value.hash === "number") {
                return doHash(value.hash, hasher)
            }
            for (const [k, v] of Object.entries(value)) {
                hasher.addString(k)
                doHash(v, hasher)
            }
            return hasher.hash
        }
    }
}

export type Hashable = boolean | number | string | HasHash | Hashable[] | {
    [k in string]: Hashable
}

export interface HasHash {
    readonly hash: number
}
