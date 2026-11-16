import { createCanvas, loadImage } from "canvas"
import { bool, rest } from "cactu-discord.js"
import { deleteCommandMessage, sendAsMember, wait } from "../shared.js"
import { command } from "../kit.js"
import type { GuildEmoji } from "discord.js"
import type { Image } from "canvas"

type WallOptions = Record<string, string | true>

const IMAGE_SIZE = 50
const EMOJI_LIST_COOLDOWN = 1000 * 60 * 30
const EMOJIS_PER_MESSAGE = 20
const EMOJIS_PER_ROW = 4
const STONE = `<:stone:539048004011687939>`
const CAT_PAWS_URL = `https://i.imgur.com/VSIrrpN.png`
const WALL_URLS:Record<string, string> = {
  mur: `https://i.imgur.com/qnOY3PP.png`,
  kot: CAT_PAWS_URL,
  zeber: `https://i.imgur.com/cz2r26C.png`,
}

const WALL_OPTIONS_HELP = [
  `"alt=kot|zeber": kot lub zeber zamiast muru`,
  `"m": lustrzane odbicie grafiki`,
  `"s": bez wygładzania krawędzi`,
  `"x=X": przesuń grafikę w poziomie o X`,
  `"r=X": obróć grafikę o X stopni`,
  `"p=X": pomniejsz grafikę o X pikseli`,
  `"mp=X": pomniejsz mur o X pikseli`,
  `"mx=X": przesuń mur o X`,
  `"mr=X": obróć mur o X stopni`,
  `"mm": mur po lewej`,
  `"md": bez muru`,
  `emoji serwera: emoji do zamurowania`,
].join( `\n` )

export const funCommands = {
  emojis: command({
    description: `Wylistuj emoji ze wszystkich serwerów bota`,
    run: async ctx => {
      const storage = await ctx.storage()
      const lastListTime = Number( storage.get( `lastEmojiListTime` ) ?? 0 )
      if (lastListTime > Date.now() - EMOJI_LIST_COOLDOWN) return ctx.send( `Spróbuj wywołać listę emoji później, przykładowo za godzinę` )

      await storage.set( `lastEmojiListTime`, Date.now() )

      const guilds = ctx.client.guilds.cache.map( guild => ({ name:guild.name, emojis:guild.emojis.cache.map( formatEmoji ) }) )
      const count = guilds.reduce( (sum, guild) => sum + guild.emojis.length, 0 )

      await ctx.send( `Znaleziono **${count}** emotikon\nAby użyć któregoś z tych emoji wpisz <nazwa_emoji>` )

      for (const guild of guilds) {
        if (!guild.emojis.length) continue

        await ctx.send( `> **${guild.name}**:` )
        for (let i = 0;  i < guild.emojis.length;  i += EMOJIS_PER_MESSAGE) await ctx.send( formatEmojisRows( guild.emojis.slice( i, i + EMOJIS_PER_MESSAGE ) ) )
      }

      await ctx.send( `I to już wszystko` )
    },
  }),

  kot: command({
    description: `Wyślij swój avatar z kocimi łapkami`,
    params: { odwrocone:bool().default( false ).describe( `Odwrócone łapki` ), tekst:rest().optional().describe( `Wiadomość` ) },
    run: async(ctx, { odwrocone, tekst }) => {
      if (!ctx.member) return

      const images = await Promise.all([ loadImage( ctx.member.user.displayAvatarURL({ extension:`png` }) ), loadImage( CAT_PAWS_URL ) ]).catch( () => null )
      if (!images) return ctx.send( `Nie udało się wczytać wymaganych grafik. Potrzebna interwencja programisty` )

      const [ avatar, paws ] = images
      const canvas = createCanvas( IMAGE_SIZE, IMAGE_SIZE )
      const canvasCtx = canvas.getContext( `2d` )

      canvasCtx.drawImage( avatar, 0, 0, IMAGE_SIZE, IMAGE_SIZE )

      if (odwrocone) {
        canvasCtx.translate( IMAGE_SIZE, 0 )
        canvasCtx.scale( -1, 1 )
      }

      canvasCtx.drawImage( paws, 0, 0, IMAGE_SIZE, IMAGE_SIZE )

      await sendAsMember( ctx, { content:tekst, files:[ canvas.toBuffer() ] } )
    },
  }),

  mur: command({
    description: `Zamuruj swój avatar albo emoji serwera`,
    params: { opcje:rest().optional().describe( WALL_OPTIONS_HELP ) },
    run: async(ctx, { opcje }) => {
      if (!ctx.member || !ctx.guild) return

      const options = parseWallOptions( opcje ?? `` )
      const emojiId = typeof options.emoji === `string` ? options.emoji.match( /\d+/ )?.[ 0 ] : undefined
      const emoji = emojiId ? ctx.guild.emojis.resolve( emojiId ) : null
      if (options.emoji && !emoji) return ctx.send( `Podane emoji nie zostało znalezione i nie można go zamurować.` )

      const imageTranslateX = Number( options.x ?? 0 )
      if (Math.abs( imageTranslateX ) > 70) return ctx.send( `Podałeś liczbę, która wykracza poza rozmiar grafiki. Podałeś ${imageTranslateX}, dozwolona maksymalna wartość bezwzględna wynosi 70` )

      const imagePadding = Number( options.p ?? 7 )
      if (imagePadding < 0 || imagePadding > 20) return ctx.send( `Padding grafiki jaki podałeś ${imagePadding} nie mieści się w wymaganym zakresie <0, 20>` )

      const wallPadding = Number( options.mp ?? 0 )
      if (wallPadding < 0 || wallPadding > 20) return ctx.send( `Padding muru jaki podałeś ${wallPadding} nie mieści się w wymaganym zakresie <0, 20>` )

      const imageUrl = emoji ? emoji.imageURL({ extension:`png` }) : ctx.member.user.displayAvatarURL({ extension:`png` })
      const wallUrl = WALL_URLS[ String( options.alt ) ] ?? WALL_URLS.mur!

      const images = await Promise.all([ loadImage( imageUrl ), loadImage( wallUrl ) ]).catch( () => null )
      if (!images) return ctx.send( `Nie udało się wczytać wymaganych grafik. Potrzebna interwencja programisty` )

      const canvas = drawWall( images[ 0 ], images[ 1 ], options, { imageTranslateX, imagePadding, wallPadding } )

      await sendAsMember( ctx, { files:[ canvas.toBuffer() ] } )
    },
  }),

  stone: command({
    description: `Rzuć kamieniem w jedną z ostatnich wiadomości`,
    run: async ctx => {
      if (!ctx.channel?.isSendable() || !ctx.member) return

      // Fetched before deleting the command message, which can be hit too
      const lastMessages = [ ...(await ctx.channel.messages.fetch({ limit:3 })).values() ]
      const chance = Math.random()
      const target = lastMessages[ pickStoneTargetIndex( chance ) ]
      const throwText = `*${ctx.member.displayName} rzuca kamieniem*    (╯°□°）╯${STONE} \n`

      await deleteCommandMessage( ctx )

      if (target?.author.id === ctx.client.user?.id) {
        const firstMessage = await ctx.channel.send( `${throwText}Kakt... ` )

        await wait( 1000 )
        await firstMessage.delete()

        return ctx.channel.send( `${throwText}${STONE}${STONE} **i został brutalnie zmasakrowany!** ${STONE}` )
      }

      if (!target) return ctx.send( `${throwText}Pudło 🤦` )
      if (chance >= .97 || target.member?.displayName === ctx.member.displayName) return ctx.send( `${throwText}**xD z typa** bo sam od siebie` )

      return ctx.send( `${throwText}**${target.member?.displayName ?? target.author.username}** oberwał` )
    },
  }),
}

/** The index of the hit message among the last 3 (newest first), or nothing for a miss */
function pickStoneTargetIndex( chance:number ) {
  if (chance >= .85) return 2
  if (chance >= .6) return 1
  if (chance >= .4) return 0

  return -1
}

function formatEmoji({ id, name, animated }:GuildEmoji) {
  const emojiName = name ?? ``
  return `<${animated ? `a` : ``}:${emojiName}:${id}> \`${emojiName}\` \`${` `.padStart( 20 - emojiName.length )}\``
}

function formatEmojisRows( emojis:string[] ) {
  const rows:string[] = []
  for (let i = 0;  i < emojis.length;  i += EMOJIS_PER_ROW) rows.push( emojis.slice( i, i + EMOJIS_PER_ROW ).join( ` ` ) )

  return rows.join( `\n` )
}

/** `alt=kot m x=5 <:emoji:123>` → `{ alt:"kot", m:true, x:"5", emoji:"<:emoji:123>" }` */
function parseWallOptions( text:string ) {
  const options:WallOptions = {}

  for (const word of text.split( / +/ ).filter( Boolean )) {
    if (/<a?:\w+:\d{17,20}>/.test( word )) {
      options.emoji = word
      continue
    }

    const [ name, value ] = word.split( `=` )
    options[ name! ] = value ?? true
  }

  return options
}

function drawWall( image:Image, wall:Image, options:WallOptions, { imageTranslateX, imagePadding, wallPadding }:{ imageTranslateX: number, imagePadding: number, wallPadding: number } ) {
  const canvas = createCanvas( IMAGE_SIZE, IMAGE_SIZE )
  const canvasCtx = canvas.getContext( `2d` )
  const imageSize = IMAGE_SIZE - imagePadding

  canvasCtx.imageSmoothingEnabled = !options.s

  canvasCtx.save()
  canvasCtx.translate( IMAGE_SIZE / 2 + imageTranslateX, IMAGE_SIZE / 2 )
  if (options.m) canvasCtx.scale( -1, 1 )
  canvasCtx.rotate( Math.PI / 180 * Number( options.r ?? 0 ) )
  canvasCtx.drawImage( image, 0, 0, image.width, image.height, -imageSize / 2, -imageSize / 2, imageSize, imageSize )
  canvasCtx.restore()

  if (options.md) return canvas

  const halfWallPadding = wallPadding / 2

  canvasCtx.save()
  canvasCtx.translate( (options.mm ? 0 : IMAGE_SIZE / 2) + Number( options.mx ?? 0 ), IMAGE_SIZE / 2 )
  canvasCtx.rotate( Math.PI / 180 * Number( options.mr ?? 0 ) )
  canvasCtx.drawImage( wall, -13 / 2 - 4 + halfWallPadding, -IMAGE_SIZE / 2 + halfWallPadding, IMAGE_SIZE - wallPadding, IMAGE_SIZE - wallPadding )
  canvasCtx.restore()

  return canvas
}
