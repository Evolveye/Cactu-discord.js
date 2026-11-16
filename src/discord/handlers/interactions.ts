import { handleSlashCommand } from "./slashCommands.js"
import type { Interaction } from "discord.js"
import type { DCInteractionHandler } from "../DiscordModule.js"
import type CactuDiscordBot from "../DiscordBot.js"

/** interactionCreate: slash commands, then guild components (buttons, selects, modals) by their customId */
export function handleInteraction( bot:CactuDiscordBot, interaction:Interaction ) {
  if (interaction.isChatInputCommand()) return handleSlashCommand( bot, interaction )
  if (!interaction.guildId || !(`customId` in interaction)) return

  const namespace = bot.namespacesData.get( interaction.guildId )
  if (!namespace?.hasModules()) return

  const handler = findInteractionHandler( namespace.getCompoundModule().interactions, interaction.customId )

  handler?.( interaction )
}

/** A handler keyed by the exact customId, or by a `/regex/` key matching it */
function findInteractionHandler( interactions:Record<string, DCInteractionHandler>, customId:string ) {
  const exactHandler = interactions[ customId ]
  if (exactHandler) return exactHandler

  return Object.entries( interactions )
    .find( ([ key ]) => key.startsWith( `/` ) && key.endsWith( `/` ) && new RegExp( key.slice( 1, -1 ) ).test( customId ) )
    ?.[ 1 ]
}
