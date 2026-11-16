import { registerGuildSlashCommands } from "./slashCommands.js"
import type { Guild } from "discord.js"
import type { DCSetup } from "../DiscordModule.js"
import type CactuDiscordBot from "../DiscordBot.js"

/**
 * guildCreate (and every guild at startup): loads the guild's namespace (the global and local modules of its namespace.json), then
 * after every (re)load connects its slash commands, client events and setups; before every reload disconnects them and runs the cleanups
 */
export async function handleGuildCreate( bot:CactuDiscordBot, guild:Guild ) {
  const namespace = bot.registerNamespace( guild.id, guild.name )
  const getEventListeners = () => namespace.hasModules() ? namespace.getCompoundModule().events : []
  let cleanups:(() => unknown)[] = []

  namespace.addModuleSource( bot.modules.createSource( namespace, guild ) )
  await namespace.loadModuleSources()

  const connectModules = async() => {
    if (!namespace.hasModules()) return

    registerGuildSlashCommands( bot, guild, namespace )
    for (const { name, listener } of getEventListeners()) bot.client.on( name, listener )

    cleanups = await runSetups( bot, guild, namespace.getCompoundModule().setups )
  }

  const disconnectModules = () => {
    for (const { name, listener } of getEventListeners()) bot.client.removeListener( name, listener )

    cleanups.forEach( cleanup => runSafely( bot, guild, cleanup ) )
    cleanups = []
  }

  namespace.on( `everyLoad`, connectModules )
  namespace.on( `preReload`, disconnectModules )

  await connectModules()
}

export function handleGuildDelete( bot:CactuDiscordBot, { name }:Guild ) {
  bot.logSystem( `I left from guild named [fgYellow]${name}[]` )
}

/** Runs every setup; returns the cleanups they gave back */
async function runSetups( bot:CactuDiscordBot, guild:Guild, setups:DCSetup[] ) {
  const results = await Promise.all( setups.map( setup => runSafely( bot, guild, setup ) ) )
  return results.filter( (result): result is () => unknown => typeof result === `function` )
}

async function runSafely( bot:CactuDiscordBot, guild:Guild, fn:() => unknown ) {
  try {
    return await fn()
  } catch (error) {
    bot.logSystem( `[fgRed]Namespace "${guild.name}"[]: a module setup or cleanup failed\n${error}` )
  }
}
