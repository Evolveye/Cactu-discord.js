import { AttachmentBuilder } from "discord.js"
import { string } from "cactu-discord.js"
import { command } from "../kit.js"
import type { APIEmbed, APIEmbedField } from "discord.js"

/** The response of https://api.mcsrvstat.us/3/<address> (Java servers); most fields are there only when the server reports them */
type MinecraftStatus = {
  online: boolean
  ip?: string
  port?: number
  hostname?: string
  version?: string
  protocol?: { version: number, name?: string }
  software?: string
  eula_blocked?: boolean
  motd?: { clean: string[] }
  players?: { online: number, max: number, list?: { name: string }[] }
  plugins?: NamedVersion[]
  mods?: NamedVersion[]
  icon?: string
  debug?: { query?: boolean, cachetime?: number }
}

type NamedVersion = { name: string, version?: string }

const DEFAULT_ADDRESS = `cactu.cc`
const STATUS_API_URL = `https://api.mcsrvstat.us/3/`
const DEFAULT_PORT = 25565
const ONLINE_COLOR = 0x4ee910
const OFFLINE_COLOR = 0xb7603d
const ICON_FILE_NAME = `server-icon.png`
const REQUEST_TIMEOUT = 1000 * 15

/** Discord's limit for an embed field's value */
const FIELD_LENGTH = 1024

export const minecraftCommand = command({
  description: `Sprawdź status serwera Minecraft: wersję, graczy, pluginy i mody`,
  params: { adres:string().default( DEFAULT_ADDRESS ).describe( `Adres serwera, opcjonalnie z portem (adres:port)` ) },
  run: async(ctx, { adres }) => {
    const status = await fetchStatus( adres )
    if (!status) return ctx.send( `Nie udało się odczytać statusu serwera **${adres}**. Spróbuj ponownie później` )

    const icon = createIconAttachment( status.icon )

    return ctx.send({ embeds:[ createStatusEmbed( adres, status, !!icon ) ], files:icon ? [ icon ] : [] })
  },
})

async function fetchStatus( address:string ) {
  const response = await fetch( STATUS_API_URL + encodeURIComponent( address ), {
    headers: { "User-Agent":`CactuDiscordBot` },
    signal: AbortSignal.timeout( REQUEST_TIMEOUT ),
  } ).catch( () => null )

  if (!response?.ok) return null

  return response.json().then( json => json as MinecraftStatus, () => null )
}

function createStatusEmbed( address:string, status:MinecraftStatus, hasIcon:boolean ): APIEmbed {
  const title = `${status.online ? `🟢` : `🔴`} ${status.hostname ?? address}`
  const dataAge = status.debug?.cachetime ? `\n-# Dane z <t:${status.debug.cachetime}:R> · mcsrvstat.us` : ``

  if (!status.online) return {
    title,
    color: OFFLINE_COLOR,
    description: `Serwer jest wyłączony albo nie odpowiada${dataAge}`,
  }

  const motd = status.motd?.clean.map( line => line.trim() ).filter( Boolean ).join( `\n` ) ?? ``

  return {
    title,
    color: ONLINE_COLOR,
    description: motd + dataAge,
    fields: createStatusFields( status ),
    thumbnail: hasIcon ? { url:`attachment://${ICON_FILE_NAME}` } : undefined,
  }
}

function createStatusFields( status:MinecraftStatus ) {
  const { players, plugins, mods } = status
  const port = status.port && status.port !== DEFAULT_PORT ? `:${status.port}` : ``
  const playerNames = players?.list?.map( player => player.name ).join( `, ` )

  const fields:APIEmbedField[] = [
    { name:`Adres`, value:`\`${status.ip ?? `?`}${port}\``, inline:true },
    { name:`Wersja`, value:status.protocol?.name ?? status.version ?? `?`, inline:true },
    { name:`Oprogramowanie`, value:status.software ?? `nie wykryto`, inline:true },
    { name:`Gracze`, value:`${players?.online ?? 0}/${players?.max ?? 0}` + (playerNames ? `\n${playerNames}` : ``) },
  ]

  if (plugins?.length) fields.push({ name:`Pluginy (${plugins.length})`, value:formatList( plugins ) })
  if (mods?.length) fields.push({ name:`Mody (${mods.length})`, value:formatList( mods ) })
  if (status.eula_blocked) fields.push({ name:`⚠️ EULA`, value:`Mojang zablokował ten serwer za naruszenie EULA` })


  return fields
}

/** `WorldEdit 7.3`, `EssentialsX`… cut to the field's length limit */
function formatList( items:NamedVersion[] ) {
  const names = items.map( item => item.version ? `${item.name} ${item.version}` : item.name )
  let text = names.join( `, ` )

  if (text.length > FIELD_LENGTH) text = text.slice( 0, FIELD_LENGTH - 1 ).replace( /, [^,]*$/, `` ) + `…`

  return text
}

/** The server icon comes as a `data:image/png;base64,…` URL */
function createIconAttachment( icon:undefined | string ) {
  const base64 = icon?.match( /^data:image\/png;base64,(.+)$/ )?.[ 1 ]
  if (!base64) return null

  return new AttachmentBuilder( Buffer.from( base64, `base64` ), { name:ICON_FILE_NAME } )
}
