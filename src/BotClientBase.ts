import fs from "fs/promises"
import { Namespace, Module } from "./namespaceStructure/index.js"
import Logger, { LoggerPart } from "./logger/index.js"
import formatDate from "./logger/formatDate.js"
import ModulesManager from "./ModulesManager.js"
import FileStorage from "./FileStorage/index.js"

export type BotBaseConfig = {}

export type NamespaceRegistrationConfig = {
  name?: string
  folderName?: string
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type NamespaceInfo<T extends Module<any>> = {
  folderPath: string
  namespace: Namespace<T>
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export default class BotClientBase<TModule extends Module<any>> {
  #dataFolderPath = `./namespaces_data/`
  #defaultConfigSubpath = `_default_config/`
  #storageFileName = `_storage.json`
  #initialized = false
  #namespacesData = new Map<string, Namespace<TModule>>()
  #storages = new Map<string, FileStorage>()
  modulesManager = new ModulesManager()

  static loggers = {
    system: new Logger( [
      { color:`fgBlack`, value:() => formatDate( Date.now(), `[hh:mm:ss:ms] ` ) },
      { color:`fgRed`, value:`System` },
      { color:`fgBlack`, value:`: ` },
      { color:`fgWhite` },
    ] as const satisfies readonly LoggerPart[], { separated:true } ),

    server: new Logger( [
      { color:`fgBlack`, value:() => formatDate( Date.now(), `[hh:mm:ss:ms] ` )  },
      { color:`fgBlue`, minLength:20, maxLength:20, align:`right` },    // Server name
      { color:`fgBlack`, value:` :: ` },
      { color:`fgBlue`, minLength:15, maxLength:15 },                   // Channel name
      { color:`fgYellow`, minLength:10, maxLength:10, align:`right` },  // Nickname
      { color:`fgBlack`, value:`: ` },
      { color:`fgBlue`, minLength:10, maxLength:10 },                   // Action type
      { color:`fgBlack`, value:` | ` },
      { color:`fgWhite` },                                              // Message
    ] as const satisfies readonly LoggerPart[], { maxLineLength:180 } ),
    dm: new Logger( [
      { color:`fgBlack`, value:() => formatDate( Date.now(), `[hh:mm:ss:ms] ` )  },
      { color:`fgBlue`, minLength:35, maxLength:35, align:`right` },    // User
      { color:`fgBlack`, value:` :: ` },
      { color:`fgYellow`, minLength:10, maxLength:10, align:`right` },  // Nickname
      { color:`fgBlack`, value:`: ` },
      { color:`fgBlue`, minLength:10, maxLength:10 },                   // Action type
      { color:`fgBlack`, value:` | ` },
      { color:`fgWhite` },                                              // Message
    ] as const satisfies readonly LoggerPart[], { maxLineLength:180 } ),
  }


  get namespacesData() {
    return this.#namespacesData
  }


  constructor() {
    fs.mkdir( this.#dataFolderPath, { recursive:true } )
  }


  logServer( server:string, channel:string, username:string, action:string, message:string ) {
    BotClientBase.loggers.server.log( server, channel, username, action, message )
  }
  logDM( recipient:string, username:string, action:string, message:string ) {
    BotClientBase.loggers.dm.log( recipient, username, action, message )
  }
  logSystem( message:string ) {
    BotClientBase.loggers.system.log( message )
  }


  registerNamespace = async(id:string, { name = id, folderName = id }:NamespaceRegistrationConfig = {}) => {
    const namespaceFolderPath = this.#getNamespaceFolderPath( folderName )
    const defualtConfigPath = this.#dataFolderPath + this.#defaultConfigSubpath

    const namespaceFolderExists = await fs.access( namespaceFolderPath ).then( () => true ).catch( () => false )
    if (!namespaceFolderExists) {
      const [ defaultConfigExists ] = await Promise.all([
        fs.readdir( defualtConfigPath ).catch<false>( () => false ),
        fs.mkdir( namespaceFolderPath, { recursive:true } ),
      ])

      if (defaultConfigExists) await Promise.all(
        defaultConfigExists.map( fileName => fs.copyFile( defualtConfigPath + fileName, namespaceFolderPath + fileName ) ),
      )
    }

    const namespace = new Namespace<TModule>( id, name )
    const configLoadingErrors = await namespace.loadConfigFromFolder( namespaceFolderPath ).catch( errs => errs )

    this.#namespacesData.set( namespace.id, namespace )

    if (this.#initialized) this.logSystem( `I have joined to guild named [fgYellow]${name}[]` )
    else {
      let message = name ? `I'm on namespace named [fgYellow]${name}[]` : `I'm on namespace with id [fgYellow]${name}[]`

      if (configLoadingErrors) configLoadingErrors.forEach( err => message += `\n[fgRed]CONFIG LOADING ERROR[]: ${err}` )

      this.logSystem( message )
    }

    return namespace
  }


  async getNamespaceFileStorage( folderName:string ) {
    let storage = this.#storages.get( folderName + this.#storageFileName )

    if (!storage) {
      storage = await FileStorage.createStorage( this.#getNamespaceFolderPath( folderName ) + this.#storageFileName )
      this.#storages.set( folderName + this.#storageFileName, storage )
    }

    return storage
  }


  endInitialization() {
    this.#initialized = true
    console.log()
    this.logSystem( `I have been started!` )
  }

  getNamespaceInfo( folderName:string, id:string ): null | NamespaceInfo<TModule> {
    const ns = this.namespacesData.get( id )

    if (!ns) return null

    return {
      namespace: ns,
      folderPath: this.#dataFolderPath + folderName + `/`,
    }
  }

  #getNamespaceFolderPath( folderName:string ) {
    return this.#dataFolderPath + folderName + `/`
  }
}
