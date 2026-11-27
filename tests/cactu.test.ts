import { AttachmentBuilder } from "discord.js"
import { afterEach, describe, expect, mock, test } from "bun:test"
import { pollFilter } from "../modules/cactu/filters/poll.js"
import { stormCommand, stormComponents } from "../modules/cactu/commands/storm.js"
import { minecraftCommand } from "../modules/cactu/commands/minecraft.js"
import { flushAsyncWork } from "./fakes.js"
import type { APIEmbed } from "discord.js"

type SentMessage = { content: string, files: AttachmentBuilder[], components: { toJSON: () => { components: { custom_id: string }[] } }[] }

const originalFetch = globalThis.fetch
const PNG_BYTES = new Uint8Array([ 0x89, 0x50, 0x4e, 0x47 ])
const MAP_LAST_MODIFIED = `Thu, 12 Nov 2026 12:11:13 GMT`
const MAP_TIMESTAMP = Date.parse( MAP_LAST_MODIFIED ) / 1000

/** Fakes the map servers: answers every URL with a tiny PNG (or a 404 page) */
function mockMapServers( isAvailable = true ) {
  const fetchMock = mock( async(_url:string) => isAvailable
    ? new Response( PNG_BYTES, { headers:{ "content-type":`image/png`, "last-modified":MAP_LAST_MODIFIED } } )
    : new Response( `Not found`, { status:404, headers:{ "content-type":`text/html` } } ) )

  globalThis.fetch = fetchMock as unknown as typeof fetch

  return fetchMock
}

/** Runs the command like the compiled module does, with a minimal message context */
async function runStorm( area:string ) {
  const send = mock( async(_content:unknown) => undefined )
  const ctx = { source:`message`, member:null, send, message:{ delete:mock( async() => undefined ) } }

  await stormCommand.run( ctx as never, { obszar:area } )

  return { send, ctx }
}

afterEach( () => {
  globalThis.fetch = originalFetch
} )

describe( `cactu: storm`, () => {
  test( `sends the current map of Poland as a file, with the refresh button, then removes the command message`, async() => {
    const fetchMock = mockMapServers()
    const { send, ctx } = await runStorm( `polska` )
    const sent = send.mock.calls[ 0 ]?.[ 0 ] as SentMessage

    expect( fetchMock.mock.calls[ 0 ]?.[ 0 ] ).toBe( `https://www.blitzortung.org/Images/image_b_pl.png` )
    expect( sent.content ).toContain( `mapa z <t:${MAP_TIMESTAMP}:R>` )
    expect( sent.files[ 0 ]?.name ).toBe( `burze-polska.png` )
    expect( sent.components[ 0 ]?.toJSON().components[ 0 ]?.custom_id ).toBe( `storm:polska` )
    expect( ctx.message.delete ).toHaveBeenCalled()
  } )

  test( `"europa" shows the map of Europe`, async() => {
    const fetchMock = mockMapServers()
    await runStorm( `Europa` )

    expect( fetchMock.mock.calls[ 0 ]?.[ 0 ] ).toContain( `lightningmaps.org/blitzortung/europe` )
  } )

  test( `an unavailable map ends with a message instead of a broken link`, async() => {
    mockMapServers( false )
    const { send } = await runStorm( `polska` )

    expect( send.mock.calls[ 0 ]?.[ 0 ] ).toStartWith( `Nie udało się pobrać mapy burzowej` )
  } )

  test( `the refresh button replaces the map with a newly downloaded one`, async() => {
    mockMapServers()

    const interaction = {
      customId: `storm:europa`,
      message: { content:`**@Tester wezwał burzę!** · mapa z <t:1000:R> · [mapa na żywo](<https://www.lightningmaps.org/>)` },
      isButton: () => true,
      deferUpdate: mock( async() => undefined ),
      editReply: mock( async(_content:unknown) => undefined ),
    }
    const refresh = Object.values( stormComponents )[ 0 ]!

    await refresh( { interaction } as never )
    await flushAsyncWork()

    const edited = interaction.editReply.mock.calls[ 0 ]?.[ 0 ] as { content: string, files: AttachmentBuilder[], attachments: unknown[] }

    expect( interaction.deferUpdate ).toHaveBeenCalled()
    expect( edited.files[ 0 ]?.name ).toBe( `burze-europa.png` )
    expect( edited.attachments ).toEqual([])
    expect( edited.content ).toBe( `**@Tester wezwał burzę!** · mapa z <t:${MAP_TIMESTAMP}:R> · [mapa na żywo](<https://www.lightningmaps.org/>)` )
  } )
} )

describe( `cactu: cc? poll`, () => {
  const pollMatch = pollFilter.match as RegExp

  test( `a question after "cc?" gets the answers as reactions, in order`, async() => {
    const react = mock( async(_emoji:string) => undefined )
    await pollFilter.run( { message:{ react } } as never )

    expect( react.mock.calls.map( ([ emoji ]) => emoji ) ).toEqual([ `👍`, `🤷`, `👎` ])
  } )

  test( `only a message starting with "cc?" and a question is a poll`, () => {
    expect( pollMatch.test( `cc? Gramy dziś?` ) ).toBeTrue()
    expect( pollMatch.test( `CC?gramy` ) ).toBeTrue()
    expect( pollMatch.test( `cc?` ) ).toBeFalse()
    expect( pollMatch.test( `a cc? gramy` ) ).toBeFalse()
  } )
} )

describe( `cactu: mc`, () => {
  type SentStatus = { embeds: APIEmbed[], files: AttachmentBuilder[] }

  /** Fakes mcsrvstat.us with the given response (or a failure) and runs the command */
  async function runMinecraft( apiResponse:null | object ) {
    globalThis.fetch = mock( async() => apiResponse
      ? new Response( JSON.stringify( apiResponse ), { headers:{ "content-type":`application/json` } } )
      : new Response( `Bad gateway`, { status:502 } ) ) as unknown as typeof fetch

    const send = mock( async(_content:unknown) => undefined )
    await minecraftCommand.run( { send } as never, { adres:`play.example.com` } )

    return send.mock.calls[ 0 ]?.[ 0 ] as SentStatus | string
  }

  test( `an online server: software, players, plugins, mods and its own icon`, async() => {
    const sent = await runMinecraft({
      online: true,
      ip: `1.2.3.4`,
      port: 25566,
      protocol: { version:777, name:`1.21.4` },
      software: `Paper`,
      motd: { clean:[ `Welcome!` ] },
      players: { online:2, max:20, list:[ { name:`Steve` }, { name:`Alex` } ] },
      plugins: [ { name:`WorldEdit`, version:`7.3` }, { name:`EssentialsX` } ],
      mods: [ { name:`BiomesOPlenty`, version:`2.1.0` } ],
      icon: `data:image/png;base64,iVBORw0KGgo=`,
      debug: { query:true, cachetime:1700000000 },
    }) as SentStatus

    const embed = sent.embeds[ 0 ]!
    const fields = Object.fromEntries( (embed.fields ?? []).map( field => [ field.name, field.value ] ) )

    expect( embed.title ).toBe( `🟢 play.example.com` )
    expect( embed.description ).toBe( `Welcome!\n-# Dane z <t:1700000000:R> · mcsrvstat.us` )
    expect( fields ).toMatchObject({
      Adres: `\`1.2.3.4:25566\``,
      Wersja: `1.21.4`,
      Oprogramowanie: `Paper`,
      Gracze: `2/20\nSteve, Alex`,
      "Pluginy (2)": `WorldEdit 7.3, EssentialsX`,
      "Mody (1)": `BiomesOPlenty 2.1.0`,
    })
    expect( embed.thumbnail?.url ).toBe( `attachment://server-icon.png` )
    expect( sent.files[ 0 ]?.name ).toBe( `server-icon.png` )
  } )

  test( `without plugins or mods, there's no section for them`, async() => {
    const sent = await runMinecraft({ online:true, players:{ online:0, max:16 }, debug:{ query:false } }) as SentStatus
    const fieldNames = sent.embeds[ 0 ]?.fields?.map( field => field.name )

    expect( fieldNames ).toEqual([ `Adres`, `Wersja`, `Oprogramowanie`, `Gracze` ])
  } )

  test( `an offline server gets a red status, the API failing gets a message`, async() => {
    const offline = await runMinecraft({ online:false, debug:{} }) as SentStatus

    expect( offline.embeds[ 0 ] ).toMatchObject({ title:`🔴 play.example.com`, description:`Serwer jest wyłączony albo nie odpowiada` })
    expect( await runMinecraft( null ) ).toStartWith( `Nie udało się odczytać statusu serwera` )
  } )
} )
