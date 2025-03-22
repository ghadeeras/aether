export type WebAssemblyModulePaths<N extends string> = Record<N, string>
export type WebAssemblyModules<N extends string> = Record<N, WebAssembly.Module>
export type WebAssemblyInstance = Pick<WebAssembly.Instance, any>
export type WebAssemblyInstances<N extends string> = Record<N, WebAssemblyInstance>

export type ResourceLoader = (path: string) => Promise<BufferSource>
export type SyncResourceLoader = (path: string) => BufferSource

export async function loadModules<N extends string>(waPath: string, modulePaths: WebAssemblyModulePaths<N>, resourceLoader: ResourceLoader = load): Promise<WebAssemblyModules<N>> {
    const result: WebAssemblyModules<string> = {}
    for (const moduleName in modulePaths) {
        const modulePath = modulePaths[moduleName]
        const path = `${waPath}/${modulePath}`
        const buffer = await resourceLoader(path)
        result[moduleName] = new WebAssembly.Module(buffer)
    }
    return result
}

export function syncLoadModules<N extends string>(waPath: string, modulePaths: WebAssemblyModulePaths<N>, resourceLoader: SyncResourceLoader): WebAssemblyModules<N> {
    const result: WebAssemblyModules<string> = {}
    for (const moduleName in modulePaths) {
        const modulePath = modulePaths[moduleName]
        const path = `${waPath}/${modulePath}`
        const buffer = resourceLoader(path)
        result[moduleName] = new WebAssembly.Module(buffer)
    }
    return result
}

export async function load(path: string) {
    const response = await fetch(path, { method: "get", mode: "no-cors" })
    const buffer = await response.arrayBuffer()
    return buffer
}

export class Linker<D extends (string | keyof {})> {

    private linking: Set<string> = new Set()
    private allInstances: WebAssemblyInstances<string> = {}

    constructor(private dependencies: WebAssemblyInstances<D>) {
    }

    static create() {
        return new Linker({})
    }

    get instances() {
        return this.dependencies
    }

    get imports() {
        return this.asImports(this.dependencies)
    }

    link<M extends string>(modules: WebAssemblyModules<M>) {
        this.allInstances = { ...this.dependencies }
        for (const moduleName in modules) {
            this.linkModule(modules, moduleName)
        }
        const result = this.allInstances as WebAssemblyInstances<D | M>;
        return new Linker(result)
    }

    private linkModule<M extends string>(modules: WebAssemblyModules<M>, moduleName: M) {
        if (this.beginLinking(moduleName)) {
            const waModule = modules[moduleName]
            const impDescriptors = WebAssembly.Module.imports(waModule)
            for (const descriptor of impDescriptors) {
                if (descriptor.module in modules) {
                    this.linkModule(modules, descriptor.module as M)
                } else if (!(descriptor.module in this.allInstances)) {
                    throw new Error(`Missing dependency ${descriptor.module}`)
                }
            }
            const waInstance = new WebAssembly.Instance(waModule, this.asImports(this.allInstances))
            this.endLinking(moduleName, waInstance)
        }
    }

    private asImports(instances: WebAssemblyInstances<string>): WebAssembly.Imports {
        const result: WebAssembly.Imports = {}
        for (const moduleName in instances) {
            const instance = instances[moduleName]
            result[moduleName] = instance.exports
        }
        return result 
    }

    private beginLinking(moduleName: string): boolean {
        if (moduleName in this.allInstances) {
            return false
        }
        if (this.linking.has(moduleName)) {
            throw new Error(`Circular dependency in ${this.linking}`);
        }
        this.linking.add(moduleName);
        return true
    }

    private endLinking(moduleName: string, waInstance: WebAssemblyInstance) {
        this.linking.delete(moduleName)
        this.allInstances[moduleName] = waInstance;
    }

}

export function required<T>(value: T | null | undefined): T {
    if (!value) {
        throw new Error("Required value is null or undefined!!!")
    }
    return value
}