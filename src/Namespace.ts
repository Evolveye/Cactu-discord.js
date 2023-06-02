import path from "path"
import fs from "fs/promises"
import Module from "./moduleStructure/Module.js"
import CommandsProcessor, { ProcessConfig } from "./CommandProcessor/index.js"

type ProcessorParam<T = unknown> = ProcessConfig<T> & {
  message: string
  processFilters?: boolean
  processCommands?: boolean
}

class Config {
  compoundModule = new Module()

  addModule( module:Module ) {
    Module.merge( this.compoundModule, module )
  }

  getCommand() {
    return this.compoundModule.commands
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
      const mod = await import( `file://` + absoluteFilepath )

      if (!mod.default || !(mod.default instanceof Module)) return false

      this.#config.addModule( mod.default )

      return true
    } catch (err) {
      console.log( `${err}` )
      return false
    }
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
