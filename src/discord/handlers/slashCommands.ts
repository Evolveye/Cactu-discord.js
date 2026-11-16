import { MessageFlags, Routes, SlashCommandBuilder } from "discord.js"
import { sendResponse } from "../responses.js"
import type { ChatInputCommandInteraction, CommandInteractionOption, Guild, MessageCreateOptions, MessagePayload, SharedSlashCommandOptions, SlashCommandBooleanOption, SlashCommandMentionableOption, SlashCommandNumberOption, SlashCommandStringOption } from "discord.js"
import type DCModule from "../DiscordModule.js"
import type { DCCmdExecutor, ModuleCmdCtx, ModuleCtx } from "../DiscordModule.js"
import type CactuDiscordBot from "../DiscordBot.js"
import type { Namespace, ProcessorParam } from "../../core/namespaceStructure/index.js"
import type { ExecutorParam } from "../../core/namespaceStructure/Scope.js"
import type { RuntimeExecutionError } from "../../core/namespaceStructure/ModuleProcessor/ExecutorError.js"

/** A slash command for private messages, registered globally on behalf of the guild whose config defines it */
export type GlobalCommandData = { cmd: SlashCommandBuilder, executor: DCCmdExecutor, registrationGuildId: string }

type SlashCommandOption = SlashCommandNumberOption | SlashCommandStringOption | SlashCommandBooleanOption | SlashCommandMentionableOption

/** Registers the namespace's slash commands in its guild; the ones for private messages are collected for {@link registerGlobalSlashCommands} */
export function registerGuildSlashCommands( bot:CactuDiscordBot, guild:Guild, namespace:Namespace<DCModule> ) {
  const app = bot.client.application
  if (!app) return

  const guildCommands = new Map<string, SlashCommandBuilder>()

  for (const [ commandKey, executor ] of Object.entries( namespace.getCompoundModule().slashCommands )) {
    const [ commandName, subcommandName ] = commandKey.split( ` ` ) as [ string, undefined | string ]

    // `command subcommand` keys share one command, registered with all its subcommands
    if (subcommandName) {
      const cmd = guildCommands.get( commandName ) ?? new SlashCommandBuilder().setName( commandName ).setDescription( executor.meta.groupDescription || `- - -` )

      cmd.addSubcommand( subcommand => addOptions( subcommand.setName( subcommandName ).setDescription( getDescription( executor ) ), executor ) )
      guildCommands.set( commandName, cmd )
      continue
    }

    const cmd = addOptions( new SlashCommandBuilder().setName( commandName ).setDescription( getDescription( executor ) ), executor )

    if (executor.meta.forPrivateMessages) bot.globals.commands.set( commandName, { cmd, executor, registrationGuildId:guild.id } )
    else guildCommands.set( commandName, cmd )
  }

  bot.rest.put( Routes.applicationGuildCommands( app.id, guild.id ), { body:[ ...guildCommands.values() ] } ).catch( logRegistrationError )
}

/** Registers the slash commands for private messages collected from all guilds */
export function registerGlobalSlashCommands( bot:CactuDiscordBot ) {
  const app = bot.client.application
  if (!app) return

  const globalCommands = [ ...bot.globals.commands.values() ].map( ({ cmd }) => cmd )

  bot.rest.put( Routes.applicationCommands( app.id ), { body:globalCommands } ).catch( logRegistrationError )
}

/** Runs a slash command with the namespace of its guild; in private messages, with the namespace that registered it */
export async function handleSlashCommand( bot:CactuDiscordBot, interaction:ChatInputCommandInteraction ) {
  const globalCommand = interaction.guildId ? undefined : bot.globals.commands.get( interaction.commandName )

  const registrationGuildId = interaction.guildId ?? globalCommand?.registrationGuildId
  if (!registrationGuildId) return

  const namespace = bot.namespacesData.get( registrationGuildId )
  if (!namespace?.hasModules()) return

  const subcommandName = interaction.options.getSubcommand( false )
  const commandKey = subcommandName ? `${interaction.commandName} ${subcommandName}` : interaction.commandName

  const executor = globalCommand?.executor ?? namespace.getCompoundModule().slashCommands[ commandKey ]
  if (!executor) return

  // A subcommand's options are nested inside it
  const options = subcommandName ? interaction.options.data[ 0 ]?.options ?? [] : interaction.options.data

  const reply = createReplier( interaction )

  /** Text commands run from a slash command (`runCmd`) skip the prefix and the permissions check */
  const createProcessorParam = (command:string): ProcessorParam<ModuleCtx> => ({
    message: command,
    prefix: null,
    checkPermissions: () => true,
    executorDataGetter: () => ({
      bot,
      ns: namespace,
      msg: null,
      interaction,
      member: interaction.member && `displayName` in interaction.member ? interaction.member : null,
      channel: interaction.channel,
      send: reply,
      sendOk: msg => reply( `✅ ${msg}` ),
      deleteMsg: () => deleteReply( interaction ),
      runCmd: nestedCommand => namespace.processMessage( createProcessorParam( nestedCommand ) ),
      getWebHook: channel => bot.getWebHook( channel ?? interaction.channel ),
    }),
    handleResponse: response => sendResponse( bot, response, namespace, { channel:interaction.channel, user:interaction.user } ),
  })

  const ctx:ModuleCmdCtx = {
    bot,
    ns: namespace,
    cmd: interaction,
    registrationGuildId,
    send: reply,
    runCmd: command => namespace.processMessage( createProcessorParam( command ) ),
    getWebHook: channel => bot.getWebHook( channel ?? interaction.channel ),
  }

  const failure = await executor.execute( readParams( executor, options ), ctx )
  if (failure) await reportSlashCommandFailure( bot, namespace, interaction, commandKey, failure )
}

/** A slash command that threw: logged for the maintainers; the user gets an error instead of an endless "is thinking…" */
async function reportSlashCommandFailure( bot:CactuDiscordBot, namespace:Namespace<DCModule>, interaction:ChatInputCommandInteraction, commandKey:string, failure:RuntimeExecutionError ) {
  bot.logSystem( `[fgRed]The slash command /${commandKey} failed[]\n${failure.stack ?? failure.message}` )

  const { translation } = namespace.getCompoundModule()
  const content = `**${translation[ `err.error` ] ?? `Error`}** · ${translation[ `err.invalidCommand` ] ?? `This command has invalid code`}`

  const reply = interaction.replied
    ? interaction.followUp({ content, flags:MessageFlags.Ephemeral })
    : interaction.deferred ? interaction.editReply({ content }) : interaction.reply({ content, flags:MessageFlags.Ephemeral })

  await reply.catch( (error:Error) => bot.logSystem( `[fgRed]Can't tell the user that /${commandKey} failed[]: ${error.message}` ) )
}

/** Discord's option naming rules: lowercase, no spaces. Used both to register options and to read their values */
function toOptionName( paramName:string ) {
  return paramName.toLowerCase().replace( / /g, `_` )
}

function getDescription( executor:DCCmdExecutor ) {
  return executor.meta.shortDescription ?? executor.meta.detailedDescription ?? `- - -`
}

/** Adds the executor's parameters as options of a command or a subcommand */
// eslint-disable-next-line @typescript-eslint/no-explicit-any -- the builders' option methods are typed by their own builder type
function addOptions<T extends SharedSlashCommandOptions<any>>( builder:T, executor:DCCmdExecutor ) {
  for (const param of executor.meta.params) {
    if (param.type === `mention`) builder.addMentionableOption( option => configureOption( option, param ) )
    else if (param.type === `bool`) builder.addBooleanOption( option => configureOption( option, param ) )
    else if (param.type === `number`) builder.addNumberOption( option => configureOption( option, param ) )
    else if (param.type === `message`) builder.addStringOption( option => configureOption( option, param ) )
  }

  return builder
}

function configureOption<T extends SlashCommandOption>( option:T, param:ExecutorParam ) {
  option.setName( toOptionName( param.name ) ).setRequired( !param.optional )
  if (param.desc) option.setDescription( param.desc )

  return option
}

function readParams( executor:DCCmdExecutor, options:readonly CommandInteractionOption[] ) {
  return executor.meta.params.map( param => options.find( option => option.name === toOptionName( param.name ) )?.value )
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
