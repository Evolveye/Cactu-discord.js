import path from "path"
import fs from "fs/promises"
import Module from "./moduleStructure/Module.js"

type ProcessorParam = {
  message?: string
  processFilters?: boolean
  processCommands?: boolean
  filtersVariablesGetter?: (matches:string[]) => void
  commandsVariablesGetter?: () => void
  performResponse?: () => void
  checkPermissions?: () => void
}

class Config {
  compoundModule = new Module()

  addModule( module:Module ) {
    Module.merge( this.compoundModule, module )
  }
}

export default class Namespace {
  #config: Config = new Config()

  id: string
  name?: string

  get config() {
    return this.#config
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

  processMessage({ message, processFilters = true, processCommands = true, ...functions }:ProcessorParam) {
    if (processFilters) console.log( `checking filteres`, { message } )
    if (processCommands) {
      console.log( `checking commands`, { message } )
    }
  }
}
