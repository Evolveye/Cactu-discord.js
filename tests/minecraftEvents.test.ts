import path from "path"
import os from "os"
import fs from "fs/promises"
import { afterEach, beforeEach, describe, expect, mock, test } from "bun:test"
import { createTranslationLookup, loadTranslations } from "../modules/minecraft/messages/translations.js"
import { escapeText, renderText } from "../modules/minecraft/messages/text.js"
import { createMinecraftMessage } from "../modules/minecraft/messages/index.js"
import minecraftModule from "../modules/minecraft/index.js"
import { parseMinecraftEvent } from "../modules/minecraft/events.js"

const PLAYER = { uuid:`069a79f4-44e9-4726-a5be-fca90e38aaf5`, name:`Notch`, skinUrl:`http://textures.minecraft.net/texture/292009a4925b58f02c77dadc3ecef07ea4c7472f64e0fdc32ce5522489362680` }
const HEAD_URL = `https://mc-heads.net/head/069a79f4-44e9-4726-a5be-fca90e38aaf5/64`
const originalConsoleLog = console.log

/** A few keys of the Polish file */
const lookup = createTranslationLookup({
  "advancements.story.mine_diamond.title": `Diamenty!`,
  "advancements.story.mine_diamond.description": `Zdobądź diamenty`,
  "advancements.end.dragon_egg.title": `Następne pokolenie`,
  "chat.type.advancement.task": `%s zdobywa osiągnięcie %s`,
  "chat.type.advancement.challenge": `%s ukończa wyzwanie %s`,
  "death.attack.mob": `%1$s został zabity przez %2$s`,
  "entity.minecraft.zombie": `Zombie`,
  "multiplayer.player.joined": `%s dołącza do gry`,
  "multiplayer.player.left": `%s opuszcza grę`,
})

/** The example payloads of MINECRAFT_EVENTS_BOT.md */
const EVENTS = {
  advancement: {
    id: `1f0c6a52-6a43-4f43-9c1e-6a8c3a0c2e11`,
    type: `advancement`,
    occurredAt: `2026-11-16T18:42:07.123456Z`,
    player: PLAYER,
    data: {
      key: `minecraft:story/mine_diamond`,
      title: { translate:`advancements.story.mine_diamond.title` },
      description: { translate:`advancements.story.mine_diamond.description` },
      frame: `task`,
    },
  },
  death: {
    id: `2f0c6a52-6a43-4f43-9c1e-6a8c3a0c2e12`,
    type: `death`,
    occurredAt: `2026-11-16T18:45:00.000Z`,
    player: PLAYER,
    data: {
      message: {
        translate: `death.attack.mob`,
        with: [
          { text:`Notch`, insertion:`Notch`, hoverEvent:{ "…":`…` }, clickEvent:{ "…":`…` } },
          { translate:`entity.minecraft.zombie`, hoverEvent:{ "…":`…` } },
        ],
      },
      cause: `minecraft:mob_attack`,
      killer: { type:`minecraft:zombie`, player:null },
      world: `world`,
      location: { x:120, y:64, z:-340 },
    },
  },
  join: { id:`3f0c6a52-6a43-4f43-9c1e-6a8c3a0c2e13`, type:`join`, occurredAt:`2026-11-16T18:40:00Z`, player:PLAYER, data:{ firstJoin:true } },
  quit: { id:`4f0c6a52-6a43-4f43-9c1e-6a8c3a0c2e14`, type:`quit`, occurredAt:`2026-11-16T18:50:00Z`, player:{ ...PLAYER, skinUrl:null }, data:{} },
}

function createMessage( event:object ) {
  const parsed = parseMinecraftEvent( event )
  if (parsed.kind !== `event`) throw new Error( `not a known event: ${JSON.stringify( parsed )}` )

  return createMinecraftMessage( parsed.event, lookup )
}

beforeEach( () => {
  console.log = mock()
} )

afterEach( () => {
  console.log = originalConsoleLog
} )

describe( `Minecraft text components`, () => {
  test( `translation keys: Polish, then the component's fallback, then the key itself`, () => {
    expect( renderText( EVENTS.death.data.message, lookup, `plain` ) ).toBe( `Notch został zabity przez Zombie` )
    expect( renderText( { translate:`constructor` }, lookup, `plain` ) ).toBe( `constructor` )
    expect( renderText( { translate:`modded.key`, fallback:`Modded %s`, with:[ 1 ] }, lookup, `plain` ) ).toBe( `Modded 1` )
    expect( renderText( { translate:`modded.key` }, lookup, `plain` ) ).toBe( `modded.key` )
  } )

  test( `placeholders: %s in order, %1$s by index, %% as a percent, missing arguments as nothing`, () => {
    const translate = (format:string, args:unknown[]) => renderText( { translate:`x`, fallback:format, with:args }, lookup, `plain` )

    expect( translate( `%s and %s`, [ `a`, `b` ] ) ).toBe( `a and b` )
    expect( translate( `%2$s before %1$s`, [ `a`, `b` ] ) ).toBe( `b before a` )
    expect( translate( `100%% of %s`, [ `a` ] ) ).toBe( `100% of a` )
    expect( translate( `%s, %s`, [ `a` ] ) ).toBe( `a, ` )
  } )

  test( `bare strings, arrays and extra children are concatenated; styling is ignored`, () => {
    expect( renderText( [ { text:`A`, color:`red`, bold:true }, `B`, { text:`C`, extra:[ `D`, { translate:`entity.minecraft.zombie` } ] } ], lookup, `plain` ) ).toBe( `ABCDZombie` )
    expect( renderText( `plain`, lookup, `plain` ) ).toBe( `plain` )
    expect( renderText( null, lookup, `plain` ) ).toBe( `` )
  } )

  test( `markdown escapes the game's text and breaks mentions, but not the translation arguments' own markdown`, () => {
    const renamedItem = { translate:`death.attack.mob`, with:[ `Cool_Guy_99`, { text:`**@everyone** <@123>` } ] }

    expect( renderText( renamedItem, lookup, `markdown` ) ).toBe( `Cool\\_Guy\\_99 został zabity przez \\*\\*@​everyone\\*\\* <​@​123>` )
    expect( escapeText( `a_b`, `plain` ) ).toBe( `a_b` )
  } )
} )

describe( `Minecraft event validation`, () => {
  test( `the example payloads are valid events`, () => {
    for (const event of Object.values( EVENTS )) expect( parseMinecraftEvent( event ).kind ).toBe( `event` )
  } )

  test( `an unknown type is valid but unknown, whatever its data`, () => {
    expect( parseMinecraftEvent({ ...EVENTS.quit, type:`chat`, data:{ message:`hi` } }) ).toEqual({ kind:`unknown`, id:EVENTS.quit.id, type:`chat` })
  } )

  test( `missing fields and wrong data of known types are invalid`, () => {
    expect( parseMinecraftEvent( null ).kind ).toBe( `invalid` )
    expect( parseMinecraftEvent({ ...EVENTS.join, id:undefined }).kind ).toBe( `invalid` )
    expect( parseMinecraftEvent({ ...EVENTS.join, occurredAt:`yesterday` }).kind ).toBe( `invalid` )
    expect( parseMinecraftEvent({ ...EVENTS.join, player:{ name:`Notch` } }).kind ).toBe( `invalid` )
    expect( parseMinecraftEvent({ ...EVENTS.join, data:{} }).kind ).toBe( `invalid` )
    expect( parseMinecraftEvent({ ...EVENTS.advancement, data:{ ...EVENTS.advancement.data, frame:`legendary` } }).kind ).toBe( `invalid` )
    expect( parseMinecraftEvent({ ...EVENTS.death, data:{ ...EVENTS.death.data, location:null } }).kind ).toBe( `invalid` )
  } )
} )

describe( `Minecraft event messages`, () => {
  test( `posted as the player: their name and 3D head by UUID`, () => {
    const { username, avatarURL } = createMessage( EVENTS.quit )

    expect( username ).toBe( `Notch` )
    expect( avatarURL ).toBe( HEAD_URL )
  } )

  test( `advancement: the game's phrase by frame, the title in bold, the description as subtext`, () => {
    expect( createMessage( EVENTS.advancement ).content ).toBe( `**Notch** zdobywa osiągnięcie **Diamenty!**\n-# Zdobądź diamenty` )

    const challenge = { ...EVENTS.advancement, data:{ ...EVENTS.advancement.data, title:{ translate:`advancements.end.dragon_egg.title` }, description:`First line\n\nSecond_line`, frame:`challenge` } }

    expect( createMessage( challenge ).content ).toBe( `**Notch** ukończa wyzwanie **Następne pokolenie**\n-# First line\n-# Second\\_line` )
  } )

  test( `advancement: without a description, only the phrase; a goal without a Polish phrase uses the built-in one`, () => {
    const goal = { ...EVENTS.advancement, data:{ ...EVENTS.advancement.data, description:``, frame:`goal` } }
    expect( createMessage( goal ).content ).toBe( `**Notch** osiąga cel **Diamenty!**` )
  } )

  test( `death: the rendered Polish message; a generic one when death messages are hidden`, () => {
    expect( createMessage( EVENTS.death ).content ).toBe( `💀 Notch został zabity przez Zombie` )
    expect( createMessage({ ...EVENTS.death, data:{ ...EVENTS.death.data, message:null } }).content ).toBe( `💀 **Notch** nie żyje` )
  } )

  test( `join: a special greeting the first time; quit: the game's phrase`, () => {
    expect( createMessage( EVENTS.join ).content ).toBe( `🎉 **Notch** dołącza do gry po raz pierwszy. Witamy na serwerze!` )
    expect( createMessage({ ...EVENTS.join, data:{ firstJoin:false } }).content ).toBe( `**Notch** dołącza do gry` )
    expect( createMessage( EVENTS.quit ).content ).toBe( `**Notch** opuszcza grę` )
  } )

  test( `player names are escaped; the text fits Discord's limit`, () => {
    expect( createMessage({ ...EVENTS.quit, player:{ ...PLAYER, name:`__Steve__` } }).content ).toBe( `**\\_\\_Steve\\_\\_** opuszcza grę` )

    const longDeath = { ...EVENTS.death, data:{ ...EVENTS.death.data, message:`x`.repeat( 3000 ) } }
    expect( createMessage( longDeath ).content ).toHaveLength( 2000 )
  } )
} )

describe( `the minecraft module`, () => {
  const handler = minecraftModule.endpoints[ `POST /events` ]!

  /** Calls the endpoint with a fake channel, which has no webhook, like without the "Manage Webhooks" permission */
  const callEndpoint = async(body:unknown) => {
    const send = mock( async(_message:unknown) => undefined )
    const client = { channels:{ fetch:mock( async(_id:string) => ({ isSendable:() => true, send }) ) } }
    const ctx = { client, settings:{ channelId:`123456789012345678` }, request:{ body } }

    const status = await handler( ctx as never )
    await new Promise( resolve => setTimeout( resolve, 20 ) )

    return { status, client, send }
  }

  beforeEach( () => {
    delete process.env.MINECRAFT_VERSION
  } )

  test( `an event: 204, then posted in the namespace's channel, as the player`, async() => {
    const { status, client, send } = await callEndpoint( EVENTS.quit )

    expect( status ).toBe( 204 )
    expect( client.channels.fetch ).toHaveBeenCalledWith( `123456789012345678` )
    expect( send.mock.calls[ 0 ]?.[ 0 ] ).toEqual({ content:`**Notch** opuszcza grę`, allowedMentions:{ parse:[] } })
  } )

  test( `every event gets posted, repeats included (the backend deduplicates)`, async() => {
    expect( (await callEndpoint( EVENTS.join )).send ).toHaveBeenCalledTimes( 1 )
    expect( (await callEndpoint( EVENTS.join )).send ).toHaveBeenCalledTimes( 1 )
  } )

  test( `an unknown type: 204, nothing posted; not an event: 400`, async() => {
    const unknown = await callEndpoint({ ...EVENTS.quit, type:`chat` })
    const invalid = await callEndpoint({ type:`join` })

    expect( unknown.status ).toBe( 204 )
    expect( unknown.send ).not.toHaveBeenCalled()
    expect( invalid.status ).toBe( 400 )
    expect( invalid.send ).not.toHaveBeenCalled()
  } )

  test( `a failed post is logged after the answer`, async() => {
    const client = { channels:{ fetch:async() => null } }
    const status = await handler( { client, settings:{ channelId:`1` }, request:{ body:EVENTS.death } } as never )
    await new Promise( resolve => setTimeout( resolve, 20 ) )

    expect( status ).toBe( 204 )
    expect( (console.log as ReturnType<typeof mock>).mock.calls.flat() ).toContain( `minecraft: a Minecraft event wasn't posted (the channel 1 isn't available)` )
  } )
} )

describe( `Minecraft language file`, () => {
  test( `the cached file of the configured version is read without downloading`, async() => {
    const folder = await fs.mkdtemp( path.join( os.tmpdir(), `cactu-translation-` ) )
    await fs.mkdir( path.join( folder, `1.21.10` ) )
    await fs.writeFile( path.join( folder, `1.21.10`, `pl_pl.json` ), JSON.stringify({ "a":`Polski` }) )

    const cachedLookup = createTranslationLookup( await loadTranslations( `1.21.10`, folder ) )

    expect([ cachedLookup( `a` ), cachedLookup( `b` ), cachedLookup( `toString` ) ]).toEqual([ `Polski`, undefined, undefined ])

    await fs.rm( folder, { recursive:true } )
  } )

  test( `without a version, no translations`, async() => {
    expect( await loadTranslations( undefined ) ).toEqual({})
  } )

} )

