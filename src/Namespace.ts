import path from "path"
import fs from "fs/promises"
import Module from "./moduleStructure/Module.js"
import importWithoutCache from "./importWithoutCache/index.js"
import ModuleProcessor, { ProcessConfig } from "./ModuleProcessor/index.js"

export type ProcessorParam<T = unknown> = ProcessConfig<T> & {
  message: string
  processFilters?: boolean
  processCommands?: boolean
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type CtxFromModule<TModule extends Module<any>> = TModule extends Module<infer TCtx> ? TCtx : never

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export default class Namespace<TModule extends Module<any> = Module> {
  #modulesFilepaths = new Set<string>()
  #moduleProcessor = new ModuleProcessor()

  id: string
  name?: string
  #compoundModule: undefined | TModule = undefined

  constructor( id:string, name?:string ) {
    this.id = id
    this.name = name
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

  addModule( filepath:string, module:TModule ) {
    this.#modulesFilepaths.add( filepath )

    if (this.#compoundModule) Module.merge( this.#compoundModule, module )
    else this.#compoundModule = module
  }

  async loadConfigFromFolder( folderpath:string ) {
    if (!folderpath.endsWith( `/` )) folderpath += `/`

    const config = await fs.readdir( folderpath )
      .then( files => Promise.all( files.map( filename => this.loadConfigFromFile( folderpath + filename ) ) ) )
      .then( () => true )
      .catch<false>( () => false )

    return config
  }

  async loadConfigFromFile( filepath:string ) {
    try {
      const absoluteFilepath = path.resolve( filepath )
      const mod = await importWithoutCache<TModule>( absoluteFilepath )

      if (!(mod instanceof Module)) return false

      this.addModule( absoluteFilepath, mod )

      return true
    } catch (err) {
      console.log( `${err}` )
      return false
    }
  }

  async reloadConfig() {
    const modulesFilepaths = this.getModulesFilepaths()
    const failedModules:string[] = []

    this.clear()

    for (const path of modulesFilepaths) {
      try {
        const mod = await importWithoutCache<TModule>( path )

        if (!(mod instanceof Module)) continue

        this.addModule( path, mod )
      } catch (err) {
        console.log( err )
        failedModules.push( path )
      }
    }

    return { failedModules }
  }

  async loadModule( path:string ) {
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
