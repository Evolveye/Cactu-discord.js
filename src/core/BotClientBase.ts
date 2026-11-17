import { Namespace } from "./namespaceStructure/index.js"
import Logger from "./logger/index.js"
import formatDate from "./logger/formatDate.js"
import HttpServer from "./http/HttpServer.js"
import type { Module } from "./namespaceStructure/index.js"
import type { LoggerPart } from "./logger/index.js"
import type { HttpServerConfig } from "./http/HttpServer.js"

export type BotBaseConfig = {
  /** Its endpoints come from the modules' `endpoints` */
  http?: HttpServerConfig
}

/** What every communicator's bot shares: its namespaces and the console logs */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export default class BotClientBase<TModule extends Module<any>> {
  #initialized = false
  #namespacesData = new Map<string, Namespace<TModule>>()

  /** Started by the communicator once its namespaces are ready, so early requests fail to connect and get sent again */
  http: null | HttpServer

  constructor( config:BotBaseConfig = {} ) {
    this.http = config.http ? new HttpServer( config.http, message => this.logSystem( message ) ) : null
  }

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


  logServer( server:string, channel:string, username:string, action:string, message:string ) {
    BotClientBase.loggers.server.log( server, channel, username, action, message )
  }
  logDM( recipient:string, username:string, action:string, message:string ) {
    BotClientBase.loggers.dm.log( recipient, username, action, message )
  }
  logSystem( message:string ) {
    BotClientBase.loggers.system.log( message )
  }


  /** Creates an empty namespace (e.g. of a guild); its modules come from the sources added to it */
  registerNamespace( id:string, name = id ) {
    const namespace = new Namespace<TModule>( id, name )

    this.#namespacesData.set( id, namespace )
    this.logSystem( this.#initialized ? `I have joined namespace named [fgYellow]${name}[]` : `I'm on namespace named [fgYellow]${name}[]` )

    return namespace
  }

  endInitialization() {
    this.#initialized = true
    console.log()
    this.logSystem( `I have been started!` )
  }
}
