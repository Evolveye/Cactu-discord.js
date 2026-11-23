/*
  `/cactu-cc mc-scan [world]`: the newest satellite scan of the Minecraft server (of any world, or of the given one) with its image,
  posted in the command's channel, plus buttons stepping back through older scans of its world.
  The buttons keep their state in their customId and the message remembers who ran the command, so they work after a restart too.
*/

import { ActionRowBuilder, AttachmentBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder, MessageFlags } from "discord.js"
import { downloadScanImage, fetchScan, fetchScans, fetchWorlds } from "./backend.js"
import type { ButtonInteraction, ChatInputCommandInteraction } from "discord.js"
import type { BackendFailure, Scan, ScanImage } from "./backend.js"

type ScanReply = Exclude<Awaited<ReturnType<typeof createScanReply>>, BackendFailure>

export const OLDER_BUTTON_ID = `cactu-cc:mc-scan:older:`
export const NEWEST_BUTTON_ID = `cactu-cc:mc-scan:newest:`

const MAX_CUSTOM_ID_LENGTH = 100
const MAX_SUGGESTIONS = 25

/** Without a limit from Discord: the limit of a guild without boosts */
const DEFAULT_UPLOAD_LIMIT = 1024 * 1024 * 10

const KIND_NAMES:Record<string, string> = { monthly:`miesięczny`, manual:`ręczny` }

const UNAVAILABLE_MESSAGE = `Skany satelitarne są teraz niedostępne. Spróbuj ponownie później.`
const NO_OLDER_SCANS_MESSAGE = `Nie ma starszych skanów tego świata.`
const SCAN_GONE_MESSAGE = `Ten skan nie jest już dostępny.`
const NOT_AUTHOR_MESSAGE = `Tymi przyciskami steruje osoba, która użyła komendy. Użyj własnego \`/cactu-cc mc-scan\`.`
const TOO_LARGE_MESSAGE = `Obraz jest za duży dla Discorda, zobacz go na stronie.`

/** Replies in the command's channel with the newest scan, of `world` or of any world */
export async function sendScan( interaction:ChatInputCommandInteraction, world:undefined | string ) {
  // The download can take longer than Discord's 3 seconds
  await interaction.deferReply()

  const reply = await createNewestScanReply( world, getUploadLimit( interaction ) )

  return interaction.editReply( reply )
}

/** The Older button: the scan before the shown one, in place of it */
export async function showOlderScan( interaction:ButtonInteraction, shownScanId:string ) {
  if (!isCommandAuthor( interaction )) return interaction.reply({ content:NOT_AUTHOR_MESSAGE, flags:MessageFlags.Ephemeral })

  await interaction.deferUpdate()

  const shownScan = await fetchScan( shownScanId )
  if (`failure` in shownScan) return replyPrivately( interaction, shownScan.failure === `notFound` ? SCAN_GONE_MESSAGE : UNAVAILABLE_MESSAGE )

  const olderScans = await fetchScans({ world:shownScan.world, limit:1, before:shownScan })
  if (`failure` in olderScans) return replyPrivately( interaction, UNAVAILABLE_MESSAGE )

  const [ olderScan ] = olderScans
  if (!olderScan) return replyPrivately( interaction, NO_OLDER_SCANS_MESSAGE )

  const reply = await createScanReply( olderScan, getUploadLimit( interaction ) )
  if (`failure` in reply) return replyPrivately( interaction, reply.failure === `notFound` ? SCAN_GONE_MESSAGE : UNAVAILABLE_MESSAGE )

  return interaction.editReply( reply )
}

/** The Newest button: the command again, for the shown scan's world */
export async function showNewestScan( interaction:ButtonInteraction, world:string ) {
  if (!isCommandAuthor( interaction )) return interaction.reply({ content:NOT_AUTHOR_MESSAGE, flags:MessageFlags.Ephemeral })

  await interaction.deferUpdate()

  const reply = await createNewestScanReply( world, getUploadLimit( interaction ) )
  if (typeof reply === `string`) return replyPrivately( interaction, reply )

  return interaction.editReply( reply )
}

/** The worlds with scans containing the typed text */
export async function suggestWorlds( typed:string ) {
  const worlds = await fetchWorlds()
  const typedText = typed.trim().toLowerCase()

  return worlds.filter( world => world.toLowerCase().includes( typedText ) ).slice( 0, MAX_SUGGESTIONS )
}

/** The newest scan's reply, or a message when there's no scan or no backend */
async function createNewestScanReply( world:undefined | string, uploadLimit:number ): Promise<string | ScanReply> {
  const noScansMessage = world ? `Nie ma jeszcze skanów satelitarnych świata ${world}.` : `Nie ma jeszcze skanów satelitarnych.`

  const scans = await fetchScans({ world, limit:1 })
  if (`failure` in scans) return UNAVAILABLE_MESSAGE

  const [ scan ] = scans
  if (!scan) return noScansMessage

  // An image gone between the requests: the scan was hidden or deleted
  const reply = await createScanReply( scan, uploadLimit )
  if (`failure` in reply) return reply.failure === `notFound` ? noScansMessage : UNAVAILABLE_MESSAGE

  return reply
}

/** The scan with its image (replacing the message's previous one) and the paging buttons */
async function createScanReply( scan:Scan, uploadLimit:number ) {
  const [ image, olderScans ] = await Promise.all([ downloadScanImage( scan, uploadLimit ), fetchScans({ world:scan.world, limit:1, before:scan }) ])
  if (`failure` in image) return image

  // Unknown whether older scans exist: the button stays and answers when there are none
  const hasOlderScans = `failure` in olderScans || olderScans.length > 0

  return {
    content: ``,
    embeds: [ createScanEmbed( scan, image ) ],
    files: image.png ? [ new AttachmentBuilder( image.png, { name:`scan.png` } ) ] : [],
    attachments: [],
    components: [ createPagingRow( scan, hasOlderScans ) ],
  }
}

function createScanEmbed( scan:Scan, image:ScanImage ) {
  const pageUrl = createScanPageUrl( scan )
  const embed = new EmbedBuilder()
    .setTitle( `Skan satelitarny – ${scan.world}` )
    .setTimestamp( new Date( scan.renderedAt ) )
    .addFields(
      { name:`Rodzaj`, value:KIND_NAMES[ scan.kind ] ?? scan.kind, inline:true },
      { name:`Rozmiar`, value:`${scan.width} × ${scan.height} bloków`, inline:true },
    )

  if (pageUrl) embed.setURL( pageUrl )

  if (!image.png) return embed.setDescription( TOO_LARGE_MESSAGE )

  embed.setImage( `attachment://scan.png` )
  if (image.scale < 1) embed.setFooter({ text:`Pomniejszono do ${(image.scale * 100).toLocaleString( `pl` )} %` })

  return embed
}

/** Older (disabled when there are none) and Newest; Newest is left out for a world whose name doesn't fit a customId */
function createPagingRow( scan:Scan, hasOlderScans:boolean ) {
  const olderButton = new ButtonBuilder().setCustomId( OLDER_BUTTON_ID + scan.id ).setLabel( `Starszy` ).setStyle( ButtonStyle.Secondary ).setDisabled( !hasOlderScans )
  const newestButtonId = NEWEST_BUTTON_ID + scan.world
  const row = new ActionRowBuilder<ButtonBuilder>().addComponents( olderButton )

  if (newestButtonId.length > MAX_CUSTOM_ID_LENGTH) return row

  return row.addComponents( new ButtonBuilder().setCustomId( newestButtonId ).setLabel( `Najnowszy` ).setStyle( ButtonStyle.Secondary ) )
}

/** The scan on the website (opening it needs a login); none without CACTU_FRONTEND_ORIGIN */
function createScanPageUrl( scan:Scan ) {
  const frontendOrigin = process.env.CACTU_FRONTEND_ORIGIN?.replace( /\/+$/, `` )
  if (!frontendOrigin || !URL.canParse( frontendOrigin )) return null

  return `${frontendOrigin}/cactu-craft/cc-satellite?world=${encodeURIComponent( scan.world )}#${scan.id}`
}

/** Discord's limit for this interaction's guild and user, boosts included */
function getUploadLimit( interaction:ChatInputCommandInteraction | ButtonInteraction ) {
  return interaction.attachmentSizeLimit || DEFAULT_UPLOAD_LIMIT
}

/** Errors of the buttons go to the player alone, keeping the shown scan */
function replyPrivately( interaction:ButtonInteraction, content:string ) {
  return interaction.followUp({ content, flags:MessageFlags.Ephemeral })
}

function isCommandAuthor( interaction:ButtonInteraction ) {
  return interaction.message.interactionMetadata?.user.id === interaction.user.id
}
