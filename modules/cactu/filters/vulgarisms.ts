import { filter } from "../kit.js"
import type { APIEmbed, Message } from "discord.js"
import type { FilterCtx } from "cactu-discord.js"
import type { CactuFilterMatchCtx } from "../shared.js"
import type { CactuSettings } from "../kit.js"

type FoundVulgarisms = {
  /** The message with every vulgarism in bold */
  highlighted: string
  words: string[]
  vulgarismsLength: number
  firstIndex: number
  lastIndex: number
}

/** Groups: the whole word, the vulgarism inside it, an optional "w(y)" prefix */
const VULGARISM = /([^\n ]*(c[i!]p[a@o0y]|(?<![^ ])c?h[vuo0ó][jy]|(?:[kg][vuo0ó]|q)t[a@][$sz]|(?:k[vuó]|q)wa|(?:[kg][vuo0ó]|q)re?[wv]|([wv]y?)?p[i!]erd[o0a@](?:l|ł[aey])|spierd|jprdl|jeb[ua@]?|r[vuo0ó]ch[a@]n[i!]e|p[i!]zd)[^\n ]*)/gi
const ALLOWED_WORDS = /(?:^https:\/\/)|recip|korwin|kotaszybkie|kurewkurnik|hojnie|hojny|hojno[sś][cć]|chojnic|wkuwa/i

const MURSHTIN_BOT_ID = `1231340364472778792`
const REPORT_DELAY = 1000 * 10
const TIMEOUT_DURATION = 1000 * 50
const QUOTE_LENGTH = 1000
const QUOTE_PADDING = 25

/** Vulgarisms get reported to the moderators after a while (unless the message is gone); a message of only vulgarisms gets its author a timeout */
export const vulgarismsFilter = filter( hasVulgarisms, ctx => {
  const found = findVulgarisms( ctx.message.content )
  if (!found) return

  if (ctx.message.author.id === MURSHTIN_BOT_ID) return ctx.message.reply( `Uspokój się bo ci walnę <a:ban:678743168275054601>` )

  setTimeout( () => reportVulgarisms( ctx, found ), REPORT_DELAY )
} )

/** Vulgarisms outside the channel where they're allowed, not counting allowed words (e.g. "korwin") and short matches inside long words */
function hasVulgarisms( ctx:CactuFilterMatchCtx ) {
  if (`name` in ctx.channel && ctx.channel.name === ctx.settings.vulgarismsAllowedChannelName) return false

  return findVulgarisms( ctx.message.content ) !== null
}

function findVulgarisms( content:string ): null | FoundVulgarisms {
  const words:string[] = []
  let vulgarismsLength = 0
  let firstIndex = Infinity
  let lastIndex = -Infinity

  const highlighted = content.replace( VULGARISM, (_match, word:string, vulgarism:string, _prefix:undefined | string, index:number) => {
    if (Math.ceil( word.length / 2 ) >= vulgarism.length) return word
    if (ALLOWED_WORDS.test( word )) return word

    words.push( word )
    vulgarismsLength += vulgarism.length
    firstIndex = Math.min( firstIndex, index )
    lastIndex = Math.max( lastIndex, index )

    return `**${word}**`
  } )

  if (!words.length) return null

  return { highlighted, words, vulgarismsLength, firstIndex, lastIndex }
}

async function reportVulgarisms( ctx:FilterCtx<CactuSettings>, found:FoundVulgarisms ) {
  const message = ctx.channel.messages.cache.get( ctx.message.id )
  if (!message?.member || !message.inGuild()) return

  if (found.vulgarismsLength >= message.content.length) {
    if (message.channel.isSendable()) await message.channel.send( `Pałka się przegła <:ferdek:1307706718674878486>` )
    await message.member.timeout( TIMEOUT_DURATION ).catch( (error:Error) => console.error( `cactu: vulgarisms timeout failed:`, error.message ) )
  }

  const roleId = ctx.settings.moderatorsRoleId
  if (!roleId) return

  const role = await message.guild.roles.fetch( roleId ).catch( () => null )
  if (!role) return console.log( `cactu: the moderators role ${roleId} doesn't exist` )

  const report = createReport( message, found )

  for (const moderator of role.members.values()) {
    moderator.send({ embeds:[ report ] }).catch( () => console.log( `cactu: can't send the report to ${moderator.displayName}` ) )
  }
}

function createReport( message:Message<true>, found:FoundVulgarisms ): APIEmbed {
  const guildUrl = `https://discord.com/channels/${message.guild.id}`
  const channelName = `name` in message.channel ? message.channel.name : `kanał`

  return {
    title: `⚠️  Filtr moderacyjny`,
    color: 0xff0000,
    fields: [
      { name:`Cytat`, value:`> ${quoteVulgarisms( found )}` },
      { name:`Długość treści`, value:`${message.content.length}`, inline:true },
      { name:`Długość wulgów`, value:`${found.vulgarismsLength}`, inline:true },
      { name:`Liczba wulgów`, value:`${found.words.length}`, inline:true },
      {
        name: `Umiejscowienie wiadomości`,
        value: ``
          + `[${message.guild.name}](${guildUrl}) `
          + `❯ [${channelName.charAt( 0 ).toUpperCase()}${channelName.slice( 1 )}](${guildUrl}/${message.channel.id}) `
          + `❯ [Wiadomość ${message.member?.displayName}](${guildUrl}/${message.channel.id}/${message.id})`,
        inline: true,
      },
    ],
  }
}

/** A long message is cut to the part around its vulgarisms */
function quoteVulgarisms( found:FoundVulgarisms ) {
  if (found.highlighted.length <= QUOTE_LENGTH) return found.highlighted

  const start = Math.max( found.firstIndex - QUOTE_PADDING, 0 )
  const end = Math.min( found.lastIndex + QUOTE_PADDING, start + QUOTE_LENGTH )

  return found.highlighted.slice( start, end )
}
