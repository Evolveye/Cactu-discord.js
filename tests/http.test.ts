import { afterAll, beforeAll, beforeEach, describe, expect, mock, test } from "bun:test"
import { defineModule } from "../src/discord/modules/define.js"
import { compileModule } from "../src/discord/modules/compile.js"
import { HttpServer, Namespace } from "../src/core/index.js"
import { createFakeBot, GUILD } from "./fakes.js"
import type { Guild } from "discord.js"
import type DCModule from "../src/discord/DiscordModule.js"
import type { HttpEndpointHandler } from "../src/core/index.js"

const SECRET = `test-secret-that-is-at-least-32-characters`

describe( `the bot's HTTP server`, () => {
  const log = mock( (_message:string) => undefined )
  const server = new HttpServer( { port:0, secret:SECRET }, log )
  let url = ``

  const post = (path:string, body:unknown, authorization:null | string = `Bearer ${SECRET}`) => fetch( url + path, {
    method: `POST`,
    headers: authorization ? { Authorization:authorization } : {},
    body: typeof body === `string` ? body : JSON.stringify( body ),
  } )

  beforeAll( async() => {
    url = `http://localhost:${await server.listen()}`
  } )

  afterAll( () => server.close() )

  beforeEach( () => log.mockClear() )

  test( `an endpoint gets the parsed JSON body and answers with a status, or a status with a JSON body`, async() => {
    const handler = mock<HttpEndpointHandler>( request => request.body === `json` ? { status:200, body:{ ok:true } } : 204 )
    const remove = server.addEndpoint( `POST /test`, handler )

    expect( (await post( `/test`, { a:1 } )).status ).toBe( 204 )
    expect( handler.mock.calls[ 0 ]?.[ 0 ] ).toMatchObject({ method:`POST`, path:`/test`, body:{ a:1 } })

    const withBody = await post( `/test`, JSON.stringify( `json` ) )

    expect( withBody.status ).toBe( 200 )
    expect( await withBody.json() ).toEqual({ ok:true })

    remove()
  } )

  test( `a missing or wrong secret: 401, before anything else`, async() => {
    const remove = server.addEndpoint( `POST /test`, () => 204 )

    expect( (await post( `/test`, {}, null )).status ).toBe( 401 )
    expect( (await post( `/test`, {}, `Bearer wrong` )).status ).toBe( 401 )
    expect( (await post( `/test`, {}, SECRET )).status ).toBe( 401 )
    expect( (await post( `/unknown`, {}, null )).status ).toBe( 401 )

    remove()
  } )

  test( `an endpoint without handlers (e.g. a module reloading) or another method: 503, so the sender tries again`, async() => {
    const remove = server.addEndpoint( `POST /test`, () => 204 )

    expect( (await fetch( `${url}/test`, { headers:{ Authorization:`Bearer ${SECRET}` } } )).status ).toBe( 503 )

    remove()

    expect( (await post( `/test`, {} )).status ).toBe( 503 )
  } )

  test( `not JSON: 400; a huge body: 413; an empty body is null`, async() => {
    const handler = mock<HttpEndpointHandler>( () => 204 )
    const remove = server.addEndpoint( `POST /test`, handler )

    expect( (await post( `/test`, `{ not json` )).status ).toBe( 400 )
    expect( (await post( `/test`, `x`.repeat( 1024 * 100 ) )).status ).toBe( 413 )
    expect( (await post( `/test`, `` )).status ).toBe( 204 )
    expect( handler.mock.calls.map( ([ request ]) => request.body ) ).toEqual([ null ])

    remove()
  } )

  test( `a throwing handler is logged and answers 500`, async() => {
    const remove = server.addEndpoint( `POST /test`, () => {
      throw new Error( `boom` )
    } )

    expect( (await post( `/test`, {} )).status ).toBe( 500 )
    expect( log.mock.calls.flat().join( `\n` ) ).toContain( `boom` )

    remove()
  } )

  test( `an endpoint has one handler at most; its removal frees it, and an old removal can't remove a newer handler`, () => {
    const remove = server.addEndpoint( `POST /test`, () => 204 )

    expect( () => server.addEndpoint( `POST /test`, () => 204 ) ).toThrow( `POST /test already has a handler` )
    const removeOtherMethod = server.addEndpoint( `GET /test`, () => 204 )
    removeOtherMethod()
    remove()

    const removeNewer = server.addEndpoint( `POST /test`, () => 204 )
    remove()

    expect( () => server.addEndpoint( `POST /test`, () => 204 ) ).toThrow()

    removeNewer()
  } )
} )

describe( `module endpoints`, () => {
  const compileEndpoints = (endpoints:Parameters<typeof defineModule>[ 0 ][ `endpoints` ]) => {
    const namespace = new Namespace<DCModule>( GUILD.id, GUILD.name )
    const bot = createFakeBot( namespace )
    const compiled = compileModule( defineModule({ endpoints }), { bot, namespace, guild:GUILD as Guild, moduleName:`test`, prefix:`cc! `, settings:{ a:1 }, getStorage:mock() as never } )

    return { bot, endpoints:compiled.endpoints }
  }

  test( `are served under /api/<namespace id>/<module name>/, with the module's context and the request`, async() => {
    const { bot, endpoints } = compileEndpoints({
      "POST /hello": ({ request, settings, namespace }) => ({ status:200, body:{ body:request.body, settings, namespaceId:namespace.id } }),
    })

    const [ endpoint ] = endpoints

    expect( endpoint?.endpoint ).toBe( `POST /api/guild-1/test/hello` )
    expect( await endpoint?.handler({ method:`POST`, path:`/api/guild-1/test/hello`, headers:{}, body:`hi` }) ).toEqual({ status:200, body:{ body:`hi`, settings:{ a:1 }, namespaceId:GUILD.id } })
    expect( bot.logServer ).toHaveBeenCalledWith( GUILD.name, `test`, `POST`, `Endpoint`, expect.stringMatching( /^\/api\/guild-1\/test\/hello → 200 \(\d+ ms\)$/ ) )
  } )

  test( `keys are normalized; a repeated method and path, or a key that isn't "METHOD /path", is logged and skipped`, () => {
    const { bot, endpoints } = compileEndpoints({
      "post nested//path/": () => 204,
      "GET /": () => 204,
      "POST /nested/path": () => 204,
      "/no-method": () => 204,
    })

    expect( endpoints.map( ({ endpoint }) => endpoint ) ).toEqual([ `POST /api/guild-1/test/nested/path`, `GET /api/guild-1/test` ])
    expect( (bot.logSystem as ReturnType<typeof mock>).mock.calls.flat() ).toEqual([
      `[fgYellow]Module "test"[]: the endpoint "POST /nested/path" repeats POST /api/guild-1/test/nested/path`,
      `[fgYellow]Module "test"[]: the endpoint "/no-method" isn't "METHOD /path"`,
    ])
  } )
} )
