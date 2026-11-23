import sharp from "sharp"
import { MessageFlags } from "discord.js"
import { afterEach, beforeEach, describe, expect, mock, test } from "bun:test"
import { fitImage } from "../modules/cactu-cc/mcScan/image.js"
import cactuCcModule from "../modules/cactu-cc/index.js"
import type { CommandDefinition, GroupDefinition } from "../src/discord/modules/define.js"
import type { Scan } from "../modules/cactu-cc/mcScan/backend.js"

type SentEmbed = { toJSON: () => { title?: string, url?: string, description?: string, image?: { url: string }, footer?: { text: string }, fields?: { value: string }[] } }
type SentButton = { custom_id: string, label: string, disabled?: boolean }
type SentReply = string | { content: string, embeds: SentEmbed[], files: unknown[], components: { toJSON: () => { components: SentButton[] } }[] }

/** Scans of a fake backend, newest first, per world */
type Backend = { scans: Scan[], imageStatus?: number, image?: Buffer, status?: number }

const SECRET = `test-secret-that-is-at-least-32-characters`
const USER_ID = `222222222222222222`
const originalFetch = globalThis.fetch
const originalConsoleLog = console.log

const scanGroup = cactuCcModule.commands[ `cactu-cc` ] as GroupDefinition
const scanCommand = scanGroup.commands[ `mc-scan` ] as CommandDefinition<{}, {}> & { autocomplete: { world: (ctx:unknown, typed:string) => Promise<string[]> } }
const [ olderComponent, newestComponent ] = Object.entries( cactuCcModule.components )

const SCAN_NEW = createScan( `b`, `2026-11-20T10:00:00.000Z` )
const SCAN_OLD = createScan( `a`, `2026-10-01T10:00:00.000Z` )
const PNG = await sharp({ create:{ width:8, height:8, channels:4, background:`#3a7` } }).png().toBuffer()

/** Fakes the backend: the list filtered like the real one (world, before/beforeId, limit), one scan, and the image */
function mockBackend({ scans, image = PNG, imageStatus = 200, status = 200 }:Backend) {
  const fetchMock = mock( async(url:string, _init:RequestInit) => {
    const { pathname, searchParams } = new URL( url )

    if (status !== 200) return Response.json( { code:`ERROR` }, { status } )
    if (pathname.endsWith( `/image.png` )) return imageStatus === 200 ? new Response( image, { headers:{ "content-length":String( image.length ) } } ) : Response.json( { code:`NOT_FOUND` }, { status:imageStatus } )

    const scanId = pathname.match( /\/scans\/([^/]+)$/ )?.[ 1 ]

    if (scanId) {
      const scan = scans.find( scan => scan.id === scanId )
      return scan ? Response.json( scan ) : Response.json( { code:`NOT_FOUND` }, { status:404 } )
    }

    const world = searchParams.get( `world` )
    const before = searchParams.get( `before` )
    const beforeId = searchParams.get( `beforeId` ) ?? ``
    const found = scans
      .filter( scan => !world || scan.world === world )
      .filter( scan => !before || scan.renderedAt < before || (scan.renderedAt === before && scan.id < beforeId) )

    return Response.json( found.slice( 0, Number( searchParams.get( `limit` ) ) ) )
  } )

  globalThis.fetch = fetchMock as unknown as typeof fetch

  return fetchMock
}

/** Runs `/cactu-cc mc-scan`, returning the reply */
async function runScan( { world, uploadLimit = 1024 * 1024 }:{ world?: string, uploadLimit?: number } = {} ) {
  const interaction = {
    attachmentSizeLimit: uploadLimit,
    reply: mock( async(_reply:unknown) => undefined ),
    deferReply: mock( async() => undefined ),
    editReply: mock( async(_reply:unknown) => undefined ),
  }

  await scanCommand.run( { source:`slash`, interaction } as never, { world } as never )

  return { interaction, reply:interaction.editReply.mock.calls[ 0 ]?.[ 0 ] as SentReply }
}

/** Clicks a paging button of a reply to `authorId`'s command */
async function clickButton( customId:string, { authorId = USER_ID }:{ authorId?: string } = {} ) {
  const component = [ olderComponent, newestComponent ].find( entry => new RegExp( entry![ 0 ].slice( 1, -1 ) ).test( customId ) )!
  const interaction = {
    customId,
    attachmentSizeLimit: 1024 * 1024,
    user: { id:USER_ID },
    message: { interactionMetadata:{ user:{ id:authorId } } },
    isButton: () => true,
    reply: mock( async(_reply:unknown) => undefined ),
    deferUpdate: mock( async() => undefined ),
    editReply: mock( async(_reply:unknown) => undefined ),
    followUp: mock( async(_reply:unknown) => undefined ),
  }

  await component[ 1 ]( { interaction, match:customId.match( new RegExp( component[ 0 ].slice( 1, -1 ) ) ) } as never )

  return interaction
}

function createScan( id:string, renderedAt:string, world = `world` ): Scan {
  return { id, kind:`monthly`, renderedAt, world, width:4096, height:2048, imageUrl:`/api/v1/minecraft/satellite/scans/${id}/image.png?v=1` }
}

function getButtons( reply:SentReply ) {
  return (reply as Exclude<SentReply, string>).components[ 0 ]!.toJSON().components
}

function getEmbed( reply:SentReply ) {
  return (reply as Exclude<SentReply, string>).embeds[ 0 ]!.toJSON()
}

beforeEach( () => {
  process.env.CACTU_BACKEND_ORIGIN = `http://localhost:3001/`
  process.env.CACTU_FRONTEND_ORIGIN = `https://cactu.cc`
  process.env.CACTU_BACKEND_API_KEY = SECRET
  console.log = mock()
} )

afterEach( () => {
  globalThis.fetch = originalFetch
  console.log = originalConsoleLog
} )

describe( `cactu-cc: /cactu-cc mc-scan`, () => {
  test( `is a slash command only, with world suggestions`, () => {
    expect( scanCommand ).toMatchObject({ slash:true, message:false })
    expect( scanCommand.autocomplete.world ).toBeFunction()
  } )

  test( `the newest scan with the bot's key: its image, the embed and the paging buttons`, async() => {
    const fetchMock = mockBackend({ scans:[ SCAN_NEW, SCAN_OLD ] })
    const { interaction, reply } = await runScan()
    const [ listUrl, listInit ] = fetchMock.mock.calls[ 0 ]!
    const embed = getEmbed( reply )

    expect( interaction.deferReply ).toHaveBeenCalled()
    expect( listUrl ).toBe( `http://localhost:3001/api/v1/minecraft/satellite/scans?limit=1` )
    expect( listInit ).toMatchObject({ headers:{ Authorization:`Bearer ${SECRET}` } })
    expect( fetchMock.mock.calls.map( ([ url ]) => url ) ).toContain( `http://localhost:3001/api/v1/minecraft/satellite/scans/b/image.png?v=1` )

    expect( embed ).toMatchObject({
      title: `Skan satelitarny – world`,
      url: `https://cactu.cc/cactu-craft/cc-satellite?world=world#b`,
      image: { url:`attachment://scan.png` },
    })
    expect( embed.fields?.map( field => field.value ) ).toEqual([ `miesięczny`, `4096 × 2048 bloków` ])
    expect( embed.footer ).toBeUndefined()
    expect( (reply as Exclude<SentReply, string>).files ).toHaveLength( 1 )
    expect( getButtons( reply ).map( button => [ button.custom_id, !!button.disabled ] ) ).toEqual([ [ `cactu-cc:mc-scan:older:b`, false ], [ `cactu-cc:mc-scan:newest:world`, false ] ])
  } )

  test( `the only scan of a world: Older is disabled`, async() => {
    mockBackend({ scans:[ SCAN_NEW, createScan( `n`, `2026-11-01T10:00:00.000Z`, `world_nether` ) ] })
    const { reply } = await runScan({ world:`world_nether` })

    expect( getEmbed( reply ).title ).toBe( `Skan satelitarny – world_nether` )
    expect( getButtons( reply )[ 0 ] ).toMatchObject({ custom_id:`cactu-cc:mc-scan:older:n`, disabled:true })
  } )

  test( `no scans, or an image gone between the requests: "no scans yet"`, async() => {
    mockBackend({ scans:[] })
    expect( (await runScan()).reply ).toBe( `Nie ma jeszcze skanów satelitarnych.` )
    expect( (await runScan({ world:`end` })).reply ).toBe( `Nie ma jeszcze skanów satelitarnych świata end.` )

    mockBackend({ scans:[ SCAN_NEW ], imageStatus:404 })
    expect( (await runScan()).reply ).toBe( `Nie ma jeszcze skanów satelitarnych.` )
  } )

  test( `the backend down or refusing the key: "unavailable", the refusal logged for the bot's owner`, async() => {
    mockBackend({ scans:[], status:503 })
    expect( (await runScan()).reply ).toBe( `Skany satelitarne są teraz niedostępne. Spróbuj ponownie później.` )

    mockBackend({ scans:[], status:403 })
    expect( (await runScan()).reply ).toBe( `Skany satelitarne są teraz niedostępne. Spróbuj ponownie później.` )

    const logs = (console.log as ReturnType<typeof mock>).mock.calls.map( args => args.join( ` ` ) )

    expect( logs ).toEqual([ `cactu-cc: the backend refused the satellite scans (HTTP 403 ERROR), check CACTU_BACKEND_API_KEY and the bot account's permissions` ])
    expect( logs.join( `\n` ) ).not.toContain( SECRET )
  } )

  test( `an image too large even scaled down: the embed and the link only`, async() => {
    mockBackend({ scans:[ SCAN_NEW ] })
    const { reply } = await runScan({ uploadLimit:10 })

    expect( getEmbed( reply ) ).toMatchObject({ description:`Obraz jest za duży dla Discorda, zobacz go na stronie.`, url:`https://cactu.cc/cactu-craft/cc-satellite?world=world#b` })
    expect( getEmbed( reply ).image ).toBeUndefined()
    expect( (reply as Exclude<SentReply, string>).files ).toEqual([])
  } )

  test( `world suggestions: the distinct worlds containing the typed text`, async() => {
    mockBackend({ scans:[ SCAN_NEW, createScan( `n`, `2026-11-01T10:00:00.000Z`, `world_nether` ), SCAN_OLD, createScan( `e`, `2026-09-01T10:00:00.000Z`, `end` ) ] })

    expect( await scanCommand.autocomplete.world( {}, `WOR` ) ).toEqual([ `world`, `world_nether` ])
    expect( await scanCommand.autocomplete.world( {}, `` ) ).toEqual([ `end`, `world`, `world_nether` ])
  } )
} )

describe( `cactu-cc: the paging buttons`, () => {
  test( `Older shows the scan before the shown one in place of it`, async() => {
    const fetchMock = mockBackend({ scans:[ SCAN_NEW, SCAN_OLD ] })
    const interaction = await clickButton( `cactu-cc:mc-scan:older:b` )
    const reply = interaction.editReply.mock.calls[ 0 ]?.[ 0 ] as SentReply

    expect( interaction.deferUpdate ).toHaveBeenCalled()
    expect( fetchMock.mock.calls.map( ([ url ]) => url ) ).toContain( `http://localhost:3001/api/v1/minecraft/satellite/scans?limit=1&world=world&before=2026-11-20T10%3A00%3A00.000Z&beforeId=b` )
    expect( getEmbed( reply ).url ).toBe( `https://cactu.cc/cactu-craft/cc-satellite?world=world#a` )
    expect( getButtons( reply )[ 0 ] ).toMatchObject({ custom_id:`cactu-cc:mc-scan:older:a`, disabled:true })
    expect( reply ).toMatchObject({ attachments:[] })
  } )

  test( `Older of the oldest scan, or of a scan gone: a private message, the shown scan stays`, async() => {
    mockBackend({ scans:[ SCAN_NEW, SCAN_OLD ] })

    const oldest = await clickButton( `cactu-cc:mc-scan:older:a` )
    const gone = await clickButton( `cactu-cc:mc-scan:older:deleted` )

    expect( oldest.followUp ).toHaveBeenCalledWith({ content:`Nie ma starszych skanów tego świata.`, flags:MessageFlags.Ephemeral })
    expect( gone.followUp ).toHaveBeenCalledWith({ content:`Ten skan nie jest już dostępny.`, flags:MessageFlags.Ephemeral })
    expect( oldest.editReply ).not.toHaveBeenCalled()
  } )

  test( `Newest shows the newest scan of the world again`, async() => {
    mockBackend({ scans:[ SCAN_NEW, SCAN_OLD ] })
    const interaction = await clickButton( `cactu-cc:mc-scan:newest:world` )

    expect( getEmbed( interaction.editReply.mock.calls[ 0 ]?.[ 0 ] as SentReply ).url ).toBe( `https://cactu.cc/cactu-craft/cc-satellite?world=world#b` )
  } )

  test( `someone else than the command's author: a private hint, nothing changes`, async() => {
    const fetchMock = mockBackend({ scans:[ SCAN_NEW, SCAN_OLD ] })
    const interaction = await clickButton( `cactu-cc:mc-scan:older:b`, { authorId:`444444444444444444` } )

    expect( interaction.reply ).toHaveBeenCalledWith({ content:`Tymi przyciskami steruje osoba, która użyła komendy. Użyj własnego \`/cactu-cc mc-scan\`.`, flags:MessageFlags.Ephemeral })
    expect( interaction.deferUpdate ).not.toHaveBeenCalled()
    expect( fetchMock ).not.toHaveBeenCalled()
  } )
} )

describe( `cactu-cc: fitting a scan into the upload limit`, () => {
  test( `a fitting image stays as it is; a larger one is halved with nearest-neighbour until it fits`, async() => {
    const noise = Buffer.from( Array.from( { length:64 * 64 * 4 }, () => Math.floor( Math.random() * 256 ) ) )
    const png = await sharp( noise, { raw:{ width:64, height:64, channels:4 } } ).png().toBuffer()

    expect( await fitImage( png, png.length ) ).toEqual({ png, scale:1 })

    const scaled = await fitImage( png, Math.ceil( png.length / 3 ) )

    expect( scaled.scale ).toBe( 0.5 )
    expect( (await sharp( scaled.png! ).metadata()).width ).toBe( 32 )
    expect( await fitImage( png, 10 ) ).toEqual({ png:null, scale:1 })
  } )
} )
