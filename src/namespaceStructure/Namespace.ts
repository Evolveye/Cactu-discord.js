import path from "path"
import fsp from "fs/promises"
import fs from "fs"
import importWithoutCache from "../importWithoutCache/index.js"
import ModuleProcessor, { ProcessConfig } from "./ModuleProcessor/index.js"
import Module from "./Module.js"

export type ProcessorParam<T = unknown> = ProcessConfig<T> & {
  message: string
  processFilters?: boolean
  processCommands?: boolean
}

export type NamespaceEvents = {
  load: () => void
  preReload: () => void
  postReload: () => void
  everyLoad: () => void
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type CtxFromModule<TModule extends Module<any>> = TModule extends Module<infer TCtx> ? TCtx : never

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export default class Namespace<TModule extends Module<any> = Module> {
  #events: Record<string, ((...params) => void)[]> = {}
  #modulesFilepaths = new Set<string>()
  #moduleProcessor = new ModuleProcessor()

  id: string
  name?: string
  #compoundModule: undefined | TModule = undefined

  constructor( id:string, name?:string ) {
    this.id = id
    this.name = name

    setTimeout( () => {
      this.dispatch( `load` )
      this.dispatch( `everyLoad` )
    }, 0 )
  }

  getCompoundModule() {
    if (!this.#compoundModule) throw new Error( `No modules in namespace` )
    return this.#compoundModule
  }

  clear() {
    this.#compoundModule = undefined
    this.#modulesFilepaths.clear()
  }

  getModulesFilepaths() {
    return [ ...this.#modulesFilepaths.values() ]
  }

  loadModule( filepath:string, module:TModule ) {
    this.#modulesFilepaths.add( filepath.replace( /\\\\/g, `/` ) ) // TODO replace paths to file with something better (example for this.unloadModule)

    if (this.#compoundModule) this.#compoundModule.merge( module )
    else this.#compoundModule = module
  }

  async unloadModule( filepath:string ) {
    let sureFilepath = filepath

    try {
      sureFilepath = this.#modulesFilepaths.has( filepath ) ? filepath : fs.realpathSync( filepath )
    } catch { /* */ }

    if (this.#modulesFilepaths.delete( sureFilepath )) return this.reloadConfig()
  }

  async loadConfigFromFolder( folderpath:string ) {
    if (!folderpath.endsWith( `/` )) folderpath += `/`

    const config = await fsp.readdir( folderpath )
      .then( files => Promise.all( files.map( filename => filename.endsWith( `.js` ) && this.loadConfigFromFile( folderpath + filename ) ) ) )
      .then( () => true )
      .catch<false>( () => false )

    return config
  }

  async loadConfigFromFile( filepath:string ) {
    try {
      const absoluteFilepath = path.resolve( filepath )
      const mod = await importWithoutCache<TModule>( absoluteFilepath )
      if (!(mod instanceof Module)) return false

      this.loadModule( absoluteFilepath, mod )

      return true
    } catch (err) {
      console.log({ err })
      return false
    }
  }

  async reloadConfig() {
    this.dispatch( `preReload` )

    const modulesFilepaths = this.getModulesFilepaths()
    const failedModules:string[] = []

    this.clear()

    for (const path of modulesFilepaths) {
      try {
        const mod = await importWithoutCache<TModule>( path )

        if (!(mod instanceof Module)) continue

        this.loadModule( path, mod )
      } catch (err) {
        console.log( err )
        failedModules.push( path )
      }
    }


    this.dispatch( `postReload` )
    this.dispatch( `everyLoad` )

    return { failedModules }
  }

  on<T extends keyof NamespaceEvents>(eventName:T, eventHandler:NamespaceEvents[T]) {
    this.#events[ eventName ] ??= []
    this.#events[ eventName ]!.push( eventHandler )
  }

  dispatch<T extends keyof NamespaceEvents>(eventName:T, ...values:Parameters<NamespaceEvents[T]>) {
    const eventScope = this.#events[ eventName ]

    if (!eventScope) return

    eventScope.forEach( f => f( ...values ) )
  }

  async importModule( path:string ) {
    return importWithoutCache( path )
    // const code = await fs.readFile( path, `utf-8` )

    // console.log( path, code )
    // console.log( eval( `(function() {\n${code}\n})()` ) )
  }

  async processMessage({ message, processFilters = true, processCommands = true, executorDataGetter, checkPermissions, handleResponse, prefix }:ProcessorParam<CtxFromModule<TModule>>) {
    if (processFilters) {
      const { filters } = this.getCompoundModule()

      if (filters) this.#moduleProcessor.applyFilters( message, filters, executorDataGetter )
    }

    if (processCommands) {
      const { commands, prefix:configPrefix } = this.getCompoundModule()

      if (commands) this.#moduleProcessor.processCommand( message, commands, {
        prefix: prefix !== undefined ? prefix : configPrefix,
        executorDataGetter,
        checkPermissions,
        handleResponse,
      } )
    }
  }
}
