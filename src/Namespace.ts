import path from "path"
import fs from "fs/promises"
import Module from "./moduleStructure/Module.js"
import importWithoutCache from "./importWithoutCache/index.js"
import CommandsProcessor, { ProcessConfig } from "./CommandProcessor/index.js"

type ProcessorParam<T = unknown> = ProcessConfig<T> & {
  message: string
  processFilters?: boolean
  processCommands?: boolean
}

class Config {
  compoundModule = new Module()
  modulesFilepaths = new Set<string>()

  addModule( filepath:string, module:Module ) {
    this.modulesFilepaths.add( filepath )
    Module.merge( this.compoundModule, module )
  }

  clear() {
    this.compoundModule = new Module()
    this.modulesFilepaths.clear()
  }

  getCommand() {
    return this.compoundModule.commands
  }

  getModulesFilepaths() {
    return [ ...this.modulesFilepaths.values() ]
  }
}

export default class Namespace<TExecutorParam=unknown> {
  #config: Config = new Config()
  #commandsProcessor = new CommandsProcessor()

  id: string
  name?: string

  get config() {
    return this.#config
  }

  get commands() {
    return this.#config.getCommand()
  }

  constructor( id:string, name?:string ) {
    this.id = id
    this.name = name
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
      const mod = await importWithoutCache<Module>( absoluteFilepath )

      if (!(mod instanceof Module)) return false

      this.#config.addModule( absoluteFilepath, mod )

      return true
    } catch (err) {
      console.log( `${err}` )
      return false
    }
  }

  async reloadConfig() {
    const modulesFilepaths = this.#config.getModulesFilepaths()
    const failedModules:string[] = []

    this.#config.clear()

    for (const path of modulesFilepaths) {
      try {
        const mod = await importWithoutCache( path )

        if (!(mod instanceof Module)) continue

        this.#config.addModule( path, mod )
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

  processMessage({ message, processFilters = true, processCommands = true, executorDataGetter, checkPermissions, handleResponse }:ProcessorParam<TExecutorParam>) {
    if (processFilters) console.log( `checking filteres`, { message } )
    if (processCommands) {
      const prefix = this.#config.compoundModule.prefix
      const { commands } = this

      if (commands && (message === prefix.trimEnd() || message.startsWith( prefix ))) {
        this.#commandsProcessor.process( message.slice( prefix.length ), commands, { executorDataGetter, checkPermissions, handleResponse } )
      }
    }
  }
}
