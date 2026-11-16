import { ActionRowBuilder, AttachmentBuilder, ButtonBuilder, ButtonStyle, MessageFlags } from "discord.js"
import { pattern } from "cactu-discord.js"
import { deleteCommandMessage } from "../shared.js"
import { command } from "../kit.js"
import type { ComponentCtx } from "cactu-discord.js"
import type { CactuSettings } from "../kit.js"

type StormArea = keyof typeof STORM_MAPS

/** Lightning maps of Blitzortung.org contributors (CC BY-SA 4.0, the credit is printed on the images), refreshed every few minutes */
const STORM_MAPS = {
  polska: `https://www.blitzortung.org/Images/image_b_pl.png`,
  europa: `https://images.lightningmaps.org/blitzortung/europe/index.php?map=0`,
}

const LIVE_MAP_URL = `https://www.lightningmaps.org/`
const REFRESH_BUTTON_PREFIX = `storm:`
const DOWNLOAD_TIMEOUT = 1000 * 15
const MAP_TIME = /mapa z <t:\d+:R>/

export const stormCommand = command({
  description: `Pokaż aktualną mapę wyładowań atmosferycznych`,
  params: { obszar:pattern( /^(?:polska|europa)$/i ).default( `polska` ).describe( `polska albo europa` ) },
  run: async(ctx, { obszar }) => {
    const area = obszar.toLowerCase() as StormArea

    const map = await downloadStormMap( area )
    if (!map) return ctx.send( `Nie udało się pobrać mapy burzowej. Na żywo: <${LIVE_MAP_URL}>` )

    await ctx.send({
      content: `**${ctx.member ?? `Ktoś`} wezwał burzę!** · ${describeMapTime( map.updatedAt )} · [mapa na żywo](<${LIVE_MAP_URL}>)`,
      files: [ map.file ],
      components: [ createRefreshRow( area ) ],
      allowedMentions: { parse:[] },
    })
    await deleteCommandMessage( ctx )
  },
})

/** The "Odśwież" button: replaces the map with the current one */
export const stormComponents = {
  [ `/^${REFRESH_BUTTON_PREFIX}/` ]: async(ctx:ComponentCtx<CactuSettings>) => {
    const { interaction } = ctx
    if (!interaction.isButton()) return

    // Downloading can take longer than the 3 seconds Discord waits for an answer
    await interaction.deferUpdate()

    const area = interaction.customId.slice( REFRESH_BUTTON_PREFIX.length ) as StormArea
    const map = await downloadStormMap( area )
    if (!map) return interaction.followUp({ content:`Nie udało się pobrać aktualnej mapy, spróbuj ponownie później`, flags:MessageFlags.Ephemeral })

    const content = interaction.message.content.replace( MAP_TIME, describeMapTime( map.updatedAt ) )

    await interaction.editReply({ content, files:[ map.file ], attachments:[], allowedMentions:{ parse:[] } })
  },
}

async function downloadStormMap( area:StormArea ) {
  const url = STORM_MAPS[ area ] ?? STORM_MAPS.polska
  const response = await fetch( url, { signal:AbortSignal.timeout( DOWNLOAD_TIMEOUT ) } ).catch( () => null )

  if (!response?.ok || !response.headers.get( `content-type` )?.startsWith( `image/` )) {
    console.log( `cactu: the storm map ${url} is unavailable (${response?.status ?? `no response`})` )
    return null
  }

  // The map server says when the image was made; without that, it's as fresh as the download
  const lastModified = Date.parse( response.headers.get( `last-modified` ) ?? `` )

  return {
    file: new AttachmentBuilder( Buffer.from( await response.arrayBuffer() ), { name:`burze-${area}.png` } ),
    updatedAt: Number.isNaN( lastModified ) ? new Date() : new Date( lastModified ),
  }
}

/** "mapa z <t:…:R>", which Discord shows as e.g. "mapa z 5 minut temu" in every reader's own time */
function describeMapTime( updatedAt:Date ) {
  return `mapa z <t:${Math.floor( updatedAt.getTime() / 1000 )}:R>`
}

function createRefreshRow( area:StormArea ) {
  return new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder().setCustomId( REFRESH_BUTTON_PREFIX + area ).setLabel( `Odśwież` ).setEmoji( `🔄` ).setStyle( ButtonStyle.Secondary ),
  )
}
