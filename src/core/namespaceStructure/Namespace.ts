import ModuleProcessor from "./ModuleProcessor/index.js"
import type { ProcessConfig } from "./ModuleProcessor/index.js"
import type Module from "./Module.js"

export type ProcessorParam<T = unknown> = ProcessConfig<T> & {
  message: string
  processFilters?: boolean
  processCommands?: boolean
}

/** Builds the namespace's modules again on every (re)load, e.g. from global module definitions */
export type ModuleSource<TModule> = () => Promise<TModule[]>

export type NamespaceEvents = {
  preReload: () => void
  postReload: () => void
  everyLoad: () => void
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type CtxFromModule<TModule extends Module<any>> = TModule extends Module<infer TCtx> ? TCtx : never

/** A place the bot works in (e.g. a guild), with the modules merged into one compound module */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export default class Namespace<TModule extends Module<any> = Module> {
  #events: Record<string, ((...params) => void)[]> = {}
  #moduleSources: ModuleSource<TModule>[] = []
  #moduleProcessor = new ModuleProcessor()
  #compoundModule: undefined | TModule = undefined

  id: string
  name?: string

  constructor( id:string, name?:string ) {
    this.id = id
    this.name = name
  }

  hasModules() {
    return !!this.#compoundModule
  }

  getCompoundModule() {
    if (!this.#compoundModule) throw new Error( `No modules in namespace` )
    return this.#compoundModule
  }

  clear() {
    this.#compoundModule = undefined
  }

  loadModule( module:TModule ) {
    if (this.#compoundModule) this.#compoundModule.merge( module )
    else this.#compoundModule = module
  }

  addModuleSource( source:ModuleSource<TModule> ) {
    this.#moduleSources.push( source )
  }

  /** Merges the modules of every source; a failing source is logged and skipped */
  async loadModuleSources() {
    for (const source of this.#moduleSources) {
      const modules = await source().catch( (error:unknown) => {
        console.log( `Namespace "${this.name ?? this.id}": a module source failed`, error )
        return []
      } )

      modules.forEach( module => this.loadModule( module ) )
    }
  }

  /** Builds all modules again from the sources */
  async reload() {
    this.dispatch( `preReload` )

    this.clear()
    await this.loadModuleSources()

    this.dispatch( `postReload` )
    this.dispatch( `everyLoad` )
  }

  on<T extends keyof NamespaceEvents>(eventName:T, eventHandler:NamespaceEvents[T]) {
    this.#events[ eventName ] ??= []
    this.#events[ eventName ]!.push( eventHandler )
  }

  dispatch<T extends keyof NamespaceEvents>(eventName:T, ...values:Parameters<NamespaceEvents[T]>) {
    this.#events[ eventName ]?.forEach( handler => handler( ...values ) )
  }

  async processMessage({ message, processFilters = true, processCommands = true, executorDataGetter, checkPermissions, handleResponse, prefix }:ProcessorParam<CtxFromModule<TModule>>) {
    if (!this.#compoundModule) return

    const { filters, commands, prefix:modulePrefix } = this.#compoundModule

    // Errors are logged here, not thrown further: as unhandled rejections, they would stop the whole process
    if (processFilters && filters) this.#moduleProcessor.applyFilters( message, filters, executorDataGetter )
      .catch( (error:unknown) => console.error( `Namespace "${this.name ?? this.id}": filtering failed`, error ) )

    if (processCommands && commands) this.#moduleProcessor.processCommand( message, commands, {
      prefix: prefix !== undefined ? prefix : modulePrefix,
      executorDataGetter,
      checkPermissions,
      handleResponse,
    } ).catch( (error:unknown) => console.error( `Namespace "${this.name ?? this.id}": a command failed`, error ) )
  }
}
