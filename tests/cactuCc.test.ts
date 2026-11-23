import { MessageFlags } from "discord.js"
import { afterEach, beforeEach, describe, expect, mock, test } from "bun:test"
import cactuCcModule from "../modules/cactu-cc/index.js"
import type { CommandDefinition, GroupDefinition } from "../src/discord/modules/define.js"

type EditedReply = string | { content: string, components: { toJSON: () => { components: { url: string, label: string }[] } }[] }

const SECRET = `test-secret-that-is-at-least-32-characters`
const originalFetch = globalThis.fetch
const originalConsoleLog = console.log
const loginCommand = (cactuCcModule.commands[ `cactu-cc` ] as GroupDefinition).commands.login as CommandDefinition

/** Fakes the Cactu backend with the given status and JSON body (or no answer at all) */
function mockBackend( status:number, body:null | object ) {
  const fetchMock = mock( async(_url:string, _init:RequestInit) => {
    if (!body) throw new Error( `ECONNREFUSED` )
    return new Response( JSON.stringify( body ), { status, headers:{ "content-type":`application/json` } } )
  } )

  globalThis.fetch = fetchMock as unknown as typeof fetch

  return fetchMock
}

/** Runs `/cactu-cc login` for a user, returning the ephemeral reply */
async function runLogin() {
  const interaction = {
    user: { id:`315215466215899146` },
    deferReply: mock( async(_options:unknown) => undefined ),
    editReply: mock( async(_reply:unknown) => undefined ),
  }

  await loginCommand.run( { source:`slash`, interaction } as never, {} )

  return { interaction, reply:interaction.editReply.mock.calls[ 0 ]?.[ 0 ] as EditedReply }
}

beforeEach( () => {
  process.env.CACTU_BACKEND_ORIGIN = `http://localhost:3001/`
  process.env.CACTU_BACKEND_API_KEY = SECRET
  console.log = mock()
} )

afterEach( () => {
  globalThis.fetch = originalFetch
  console.log = originalConsoleLog
} )

describe( `cactu-cc: /cactu-cc login`, () => {
  test( `is a slash command only, so the code can't land in a channel`, () => {
    expect( loginCommand ).toMatchObject({ slash:true, message:false })
  } )

  test( `asks the backend with the caller's Discord ID and replies only to them: the code, its expiry and the login button`, async() => {
    const fetchMock = mockBackend( 201, { code:`K7QM-2XPA`, expiresAt:1762870000000, loginUri:`https://cactu.cc/auth/login/callback#method=discord-bot&code=K7QM2XPA` } )
    const { interaction, reply } = await runLogin()
    const [ url, init ] = fetchMock.mock.calls[ 0 ]!

    expect( url ).toBe( `http://localhost:3001/api/v1/auth/login-codes` )
    expect( init ).toMatchObject({ method:`POST`, headers:{ Authorization:`Bearer ${SECRET}` }, body:`{"discordId":"315215466215899146"}` })
    expect( interaction.deferReply ).toHaveBeenCalledWith({ flags:MessageFlags.Ephemeral })

    const { content, components } = reply as Exclude<EditedReply, string>

    expect( content ).toBe( [
      `**Kod logowania: \`K7QM-2XPA\`** · wygasa <t:1762870000:R>`,
      `Wpisz go w okienku logowania na stronie albo kliknij przycisk poniżej.`,
      `Nie podawaj nikomu tego kodu: kto go zna, może zalogować się jako Ty.`,
    ].join( `\n` ) )
    expect( components[ 0 ]?.toJSON().components[ 0 ] ).toMatchObject({ label:`Zaloguj na stronie`, url:`https://cactu.cc/auth/login/callback#method=discord-bot&code=K7QM2XPA` })
  } )

  test( `without a login link from the backend, only the code`, async() => {
    mockBackend( 201, { code:`K7QM-2XPA`, expiresAt:1762870000000, loginUri:null } )
    const { reply } = await runLogin()

    expect( (reply as Exclude<EditedReply, string>).components ).toEqual([])
    expect( (reply as Exclude<EditedReply, string>).content ).toContain( `Wpisz go w okienku logowania na stronie.` )
  } )

  test( `Discord unavailable, the backend down or not answering: "try again in a moment"`, async() => {
    mockBackend( 503, { code:`DISCORD_UNAVAILABLE` } )
    expect( (await runLogin()).reply ).toBe( `Nie udało się teraz przygotować kodu. Spróbuj ponownie za chwilę.` )

    mockBackend( 502, { code:`BAD_GATEWAY` } )
    expect( (await runLogin()).reply ).toBe( `Nie udało się teraz przygotować kodu. Spróbuj ponownie za chwilę.` )

    mockBackend( 0, null )
    expect( (await runLogin()).reply ).toBe( `Nie udało się teraz przygotować kodu. Spróbuj ponownie za chwilę.` )
  } )

  test( `a link without http(s) (the backend's CACTU_FRONTEND_ORIGIN): the code alone, logged without the code`, async() => {
    mockBackend( 201, { code:`K7QM-2XPA`, expiresAt:1762870000000, loginUri:`cactu.cc/auth/login/callback#method=discord-bot&code=K7QM2XPA` } )
    const { reply } = await runLogin()
    const logs = (console.log as ReturnType<typeof mock>).mock.calls.map( args => args.join( ` ` ) )

    expect( (reply as Exclude<EditedReply, string>).components ).toEqual([])
    expect( (reply as Exclude<EditedReply, string>).content ).toStartWith( `**Kod logowania: \`K7QM-2XPA\`**` )
    expect( logs ).toEqual([ `cactu-cc: the backend's login link isn't an http(s) URL (cactu.cc/auth/login/callback), check its CACTU_FRONTEND_ORIGIN` ])
  } )

  test( `Discord refusing the login button: the code alone, logged without the code`, async() => {
    mockBackend( 201, { code:`K7QM-2XPA`, expiresAt:1762870000000, loginUri:`http://localhost:3000/auth/login/callback#method=discord-bot&code=K7QM2XPA` } )

    const interaction = {
      user: { id:`315215466215899146` },
      deferReply: mock( async(_options:unknown) => undefined ),
      editReply: mock( async(reply:{ components: unknown[] }) => {
        if (reply.components.length) throw Object.assign( new Error( `Invalid Form Body` ), { name:`DiscordAPIError[50035]`, code:50035 } )
      } ),
    }

    await loginCommand.run( { source:`slash`, interaction } as never, {} )

    const [ withButton, codeOnly ] = interaction.editReply.mock.calls.map( ([ reply ]) => reply as Exclude<EditedReply, string> )
    const logs = (console.log as ReturnType<typeof mock>).mock.calls.map( args => args.join( ` ` ) )

    expect( withButton?.components ).toHaveLength( 1 )
    expect( codeOnly?.components ).toEqual([])
    expect( codeOnly?.content ).toContain( `K7QM-2XPA` )
    expect( logs ).toEqual([ `cactu-cc: Discord refused the login button (DiscordAPIError[50035] 50035, link: http://localhost:3000/auth/login/callback), sending the code alone` ])
  } )

  test( `a wrong secret, a bad request or no configuration: "something went wrong", logged without the secret`, async() => {
    mockBackend( 401, { code:`UNAUTHORIZED` } )
    expect( (await runLogin()).reply ).toBe( `Coś poszło nie tak. Spróbuj ponownie później.` )

    mockBackend( 400, { code:`BAD_REQUEST` } )
    expect( (await runLogin()).reply ).toBe( `Coś poszło nie tak. Spróbuj ponownie później.` )

    delete process.env.CACTU_BACKEND_API_KEY
    expect( (await runLogin()).reply ).toBe( `Coś poszło nie tak. Spróbuj ponownie później.` )

    const logs = (console.log as ReturnType<typeof mock>).mock.calls.map( args => args.join( ` ` ) )

    expect( logs ).toEqual([
      `cactu-cc: no login code for a user (HTTP 401 UNAUTHORIZED, check CACTU_BACKEND_API_KEY)`,
      `cactu-cc: no login code for a user (HTTP 400 BAD_REQUEST)`,
      `cactu-cc: no login code for a user (CACTU_BACKEND_ORIGIN or CACTU_BACKEND_API_KEY isn't set)`,
    ])
    expect( logs.join( `\n` ) ).not.toContain( SECRET )
  } )
} )
