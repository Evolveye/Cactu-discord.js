/* The bot's HTTP server, for other services (e.g. the Cactu backend): modules add their endpoints to it as they load, and remove them before a reload */

import http from "node:http"
import crypto from "node:crypto"
import type { AddressInfo } from "node:net"

export type HttpServerConfig = {
  port: number
  /** Every request has to carry `Authorization: Bearer <secret>` */
  secret: string
}

export type HttpRequest = { method: string, path: string, headers: http.IncomingHttpHeaders, body: unknown }
export type HttpAnswer = number | { status: number, body: unknown }

/** Should answer quickly: a slow job (e.g. posting on Discord) goes on after the answer */
export type HttpEndpointHandler = (request:HttpRequest) => HttpAnswer | Promise<HttpAnswer>

const MAX_BODY_SIZE = 1024 * 64

export default class HttpServer {
  #config: HttpServerConfig
  #log: (message:string) => void
  #server: null | http.Server = null

  /** `METHOD /path` → its handler */
  #endpoints = new Map<string, HttpEndpointHandler>()

  constructor( config:HttpServerConfig, log:(message:string) => void ) {
    this.#config = config
    this.#log = log
  }

  /** Opens the port (once); resolves with its number, which is useful with port 0 */
  listen() {
    if (this.#server) return Promise.resolve( (this.#server.address() as AddressInfo).port )

    const server = http.createServer( (request, response) => {
      this.#handleRequest( request, response ).catch( () => answer( response, 400 ) )
    } )

    this.#server = server

    return new Promise<number>( (resolve, reject) => {
      server.once( `error`, reject )
      server.listen( this.#config.port, () => {
        const { port } = server.address() as AddressInfo

        server.on( `error`, error => this.#log( `The HTTP server failed: ${error.message}` ) )
        this.#log( `I have started the HTTP server on port [fgYellow]${port}[]` )
        resolve( port )
      } )
    } )
  }

  close() {
    this.#server?.close()
    this.#server = null
  }

  /** `endpoint` is `METHOD /path`, with one handler at most; returns the handler's removal */
  addEndpoint( endpoint:string, handler:HttpEndpointHandler ) {
    if (this.#endpoints.has( endpoint )) throw new Error( `${endpoint} already has a handler` )

    this.#endpoints.set( endpoint, handler )

    return () => {
      if (this.#endpoints.get( endpoint ) === handler) this.#endpoints.delete( endpoint )
    }
  }

  async #handleRequest( request:http.IncomingMessage, response:http.ServerResponse ) {
    const method = request.method ?? `GET`
    const { pathname } = new URL( request.url ?? `/`, `http://localhost` )
    if (!isAuthorized( request.headers.authorization, this.#config.secret )) return answer( response, 401 )

    // Without a handler, the module may be reloading or not loaded yet: the sender may try again later
    const handler = this.#endpoints.get( `${method} ${pathname}` )
    if (!handler) return answer( response, 503 )

    const body = await readBody( request )
    if (body === null) return answer( response, 413 )

    const json = body ? parseJson( body ) : null
    if (json === undefined) return answer( response, 400 )

    return answer( response, await this.#runHandler( handler, { method, path:pathname, headers:request.headers, body:json } ) )
  }

  async #runHandler( handler:HttpEndpointHandler, request:HttpRequest ): Promise<HttpAnswer> {
    try {
      return await handler( request )
    } catch (error) {
      this.#log( `[fgRed]${request.method} ${request.path}[] failed\n${error instanceof Error ? error.stack ?? error.message : error}` )
      return 500
    }
  }
}

/** Compared in constant time; hashing first evens out the lengths, which `timingSafeEqual` requires */
function isAuthorized( header:undefined | string, secret:string ) {
  const token = header?.match( /^Bearer (.+)$/ )?.[ 1 ]
  if (!token) return false

  return crypto.timingSafeEqual( hash( token ), hash( secret ) )
}

function hash( text:string ) {
  return crypto.createHash( `sha256` ).update( text ).digest()
}

/** The body as text; null when it's too big (still read to the end, so the answer gets through) */
async function readBody( request:http.IncomingMessage ) {
  const chunks:Buffer[] = []
  let size = 0

  for await (const chunk of request as AsyncIterable<Buffer>) {
    size += chunk.length
    if (size <= MAX_BODY_SIZE) chunks.push( chunk )
  }

  return size > MAX_BODY_SIZE ? null : Buffer.concat( chunks ).toString( `utf-8` )
}

function parseJson( text:string ) {
  try {
    return JSON.parse( text ) as unknown
  } catch {
    return undefined
  }
}

function answer( response:http.ServerResponse, httpAnswer:HttpAnswer ) {
  if (response.headersSent || response.destroyed) return
  if (typeof httpAnswer === `number`) return response.writeHead( httpAnswer ).end()

  response.writeHead( httpAnswer.status, { "Content-Type":`application/json` } ).end( JSON.stringify( httpAnswer.body ) )
}
