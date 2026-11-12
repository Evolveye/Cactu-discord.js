import { Routes, SlashCommandBuilder } from "discord.js"
import { sendResponse } from "../responses.js"
import type { ChatInputCommandInteraction, Guild, MessageCreateOptions, MessagePayload, SlashCommandBooleanOption, SlashCommandMentionableOption, SlashCommandNumberOption, SlashCommandStringOption } from "discord.js"
import type DCModule from "../DiscordModule.js"
import type { DCCmdExecutor, ModuleCmdCtx, ModuleCtx } from "../DiscordModule.js"
import type CactuDiscordBot from "../DiscordBot.js"
import type { Namespace, ProcessorParam } from "../../core/namespaceStructure/index.js"
import type { ExecutorParam } from "../../core/namespaceStructure/Scope.js"

/** A slash command for private messages, registered globally on behalf of the guild whose config defines it */
export type GlobalCommandData = { cmd: SlashCommandBuilder, executor: DCCmdExecutor, registrationGuildId: string }

type SlashCommandOption = SlashCommandNumberOption | SlashCommandStringOption | SlashCommandBooleanOption | SlashCommandMentionableOption

/** Registers the namespace's slash commands in its guild; the ones for private messages are collected for {@link registerGlobalSlashCommands} */
export function registerGuildSlashCommands( bot:CactuDiscordBot, guild:Guild, namespace:Namespace<DCModule> ) {
  const app = bot.client.application
  if (!app) return

  const guildCommands:SlashCommandBuilder[] = []

  for (const [ commandName, executor ] of Object.entries( namespace.getCompoundModule().slashCommands )) {
    const cmd = createSlashCommand( commandName, executor )

    if (executor.meta.forPrivateMessages) bot.globals.commands.set( commandName, { cmd, executor, registrationGuildId:guild.id } )
    else guildCommands.push( cmd )
  }

  bot.rest.put( Routes.applicationGuildCommands( app.id, guild.id ), { body:guildCommands } ).catch( logRegistrationError )
}

/** Registers the slash commands for private messages collected from all guilds */
export function registerGlobalSlashCommands( bot:CactuDiscordBot ) {
  const app = bot.client.application
  if (!app) return

  const globalCommands = [ ...bot.globals.commands.values() ].map( ({ cmd }) => cmd )

  bot.rest.put( Routes.applicationCommands( app.id ), { body:globalCommands } ).catch( logRegistrationError )
}

/** Runs a slash command with the namespace of its guild; in private messages, with the namespace that registered it */
export function handleSlashCommand( bot:CactuDiscordBot, interaction:ChatInputCommandInteraction ) {
  const globalCommand = interaction.guildId ? undefined : bot.globals.commands.get( interaction.commandName )

  const registrationGuildId = interaction.guildId ?? globalCommand?.registrationGuildId
  if (!registrationGuildId) return

  const namespace = bot.namespacesData.get( registrationGuildId )
  if (!namespace) return

  const executor = globalCommand?.executor ?? namespace.getCompoundModule().slashCommands[ interaction.commandName ]
  if (!executor) return

  const reply = createReplier( interaction )
  const getStorage = () => bot.getGuildStorage( bot.client.guilds.cache.get( registrationGuildId ) )

  /** Text commands run from a slash command (`runCmd`) skip the prefix and the permissions check */
  const createProcessorParam = (command:string): ProcessorParam<ModuleCtx> => ({
    message: command,
    prefix: null,
    checkPermissions: () => true,
    executorDataGetter: () => ({
      bot,
      ns: namespace,
      msg: null,
      member: interaction.member && `displayName` in interaction.member ? interaction.member : null,
      channel: interaction.channel,
      send: reply,
      sendOk: msg => reply( `✅ ${msg}` ),
      getStorage,
      deleteMsg: () => deleteReply( interaction ),
      runCmd: nestedCommand => namespace.processMessage( createProcessorParam( nestedCommand ) ),
      getWebHook: channel => bot.getWebHook( channel ?? interaction.channel ),
    }),
    handleResponse: response => sendResponse( bot, response, namespace, { channel:interaction.channel, member:interaction.member, user:interaction.user } ),
  })

  const ctx:ModuleCmdCtx = {
    bot,
    ns: namespace,
    cmd: interaction,
    registrationGuildId,
    send: reply,
    runCmd: command => namespace.processMessage( createProcessorParam( command ) ),
    getStorage,
    getWebHook: channel => bot.getWebHook( channel ?? interaction.channel ),
  }

  executor.execute( readParams( executor, interaction ), ctx )
}

/** Discord's option naming rules: lowercase, no spaces. Used both to register options and to read their values */
function toOptionName( paramName:string ) {
  return paramName.toLowerCase().replace( / /g, `_` )
}

function createSlashCommand( name:string, executor:DCCmdExecutor ) {
  const cmd = new SlashCommandBuilder()
    .setName( name )
    .setDescription( executor.meta.shortDescription ?? executor.meta.detailedDescription ?? `- - -` )

  for (const param of executor.meta.params) {
    if (param.type === `mention`) cmd.addMentionableOption( option => configureOption( option, param ) )
    else if (param.type === `bool`) cmd.addBooleanOption( option => configureOption( option, param ) )
    else if (param.type === `number`) cmd.addNumberOption( option => configureOption( option, param ) )
    else if (param.type === `message`) cmd.addStringOption( option => configureOption( option, param ) )
  }

  return cmd
}

function configureOption<T extends SlashCommandOption>( option:T, param:ExecutorParam ) {
  option.setName( toOptionName( param.name ) ).setRequired( !param.optional )
  if (param.desc) option.setDescription( param.desc )

  return option
}

function readParams( executor:DCCmdExecutor, interaction:ChatInputCommandInteraction ) {
  return executor.meta.params.map( param => interaction.options.data.find( option => option.name === toOptionName( param.name ) )?.value )
}

/** Sends to the command's channel: the first message replies, a deferred reply gets edited, later messages follow up */
function createReplier( interaction:ChatInputCommandInteraction ) {
  return (msg:string | MessagePayload | MessageCreateOptions) => {
    const options = typeof msg === `string` ? { content:msg } : `content` in msg ? { content:msg.content, components:msg.components } : null
    if (!options) throw new Error( `Cannot send message` )

    if (interaction.replied) return interaction.followUp( options )
    if (interaction.deferred) return interaction.editReply( options )

    return interaction.reply( options )
  }
}

/** Removes the command's reply; with no reply yet, creates a deferred one just to remove it */
async function deleteReply( interaction:ChatInputCommandInteraction ) {
  if (!interaction.deferred && !interaction.replied) await interaction.deferReply()
  await interaction.deleteReply()
}

function logRegistrationError( err ) {
  if (err?.rawError?.message) console.log( `Error`, err.rawError.message, JSON.stringify( err.rawError.errors, null, 2 ) )
  else console.log( err )
}
