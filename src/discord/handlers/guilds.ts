import { registerGuildSlashCommands } from "./slashCommands.js"
import type { Guild } from "discord.js"
import type CactuDiscordBot from "../DiscordBot.js"

/** guildCreate (and every guild at startup): loads the guild's namespace, then connects its slash commands and client events after every (re)load */
export async function handleGuildCreate( bot:CactuDiscordBot, guild:Guild ) {
  const namespace = await bot.registerNamespace( guild.id, { name:guild.name, folderName:bot.getGuildFolderName( guild ) } )
  const getModuleEvents = () => Object.entries( namespace.getCompoundModule().events )

  const connectModule = () => {
    registerGuildSlashCommands( bot, guild, namespace )
    for (const [ eventName, handler ] of getModuleEvents()) bot.client.on( eventName, handler )
  }

  namespace.on( `everyLoad`, connectModule )
  namespace.on( `preReload`, () => {
    for (const [ eventName, handler ] of getModuleEvents()) bot.client.removeListener( eventName, handler )
  } )

  connectModule()
}

export function handleGuildDelete( bot:CactuDiscordBot, { name }:Guild ) {
  bot.logSystem( `I left from guild named [fgYellow]${name}[]` )
}
