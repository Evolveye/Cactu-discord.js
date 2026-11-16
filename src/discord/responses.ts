import { ContainerBuilder, MessageFlags, SeparatorSpacingSize } from "discord.js"
import { describeResponse } from "../core/responses.js"
import type { Message, TextBasedChannel, User } from "discord.js"
import type { AccessChecker, CommandHelpParam, CommandHelpResponse, ErrorResponse, HelpEntry, HelpParam, HelpResponse } from "../core/responses.js"
import type { Namespace, ProcessorResponseHandlerParam } from "../core/namespaceStructure/index.js"
import type DCModule from "./DiscordModule.js"
import type CactuDiscordBot from "./DiscordBot.js"

export type ResponseTarget = {
  channel: null | TextBasedChannel
  user: User
  /** The response replies to it, so Discord shows the caller's small avatar and name above */
  replyTo?: Message
  /** The help lists only what passes; without it, everything */
  canAccess?: AccessChecker
}

const ERROR_COLOR = 0xb7603d
const HELP_COLOR = 0x4ee910

/** Discord's limit for the text of all components of one message */
const TEXT_LIMIT = 4000
const TRUNCATION_MARK = `\n-# …`

/** Shows a processor response (a command error or the commands help); resolves with what got sent, or null */
export async function sendResponse( bot:CactuDiscordBot, response:ProcessorResponseHandlerParam, namespace:Namespace<DCModule>, { channel, user, replyTo, canAccess }:ResponseTarget ) {
  const { translation, prefix } = namespace.getCompoundModule()

  const content = describeResponse( response, translation, prefix, canAccess )
  if (!content) return null

  if (content.type === `error` && content.runtimeError) bot.logSystem( `[fgRed]ERR[]: ${content.runtimeError}` )
  if (!channel?.isSendable()) return null

  const container = content.type === `error`
    ? createErrorContainer( content, user )
    : content.type === `help` ? createHelpContainer( content, user ) : createCommandHelpContainer( content, user )

  await channel.send({
    components: [ container ],
    flags: MessageFlags.IsComponentsV2,
    // The caller's mention and the reply show who asked, without pinging anyone
    allowedMentions: { parse:[], repliedUser:false },
    reply: replyTo ? { messageReference:replyTo, failIfNotExists:false } : undefined,
  })

  return content
}

/**
 * ┃ **Error** · No command
 * ┃ -# @User · `unknown`
 */
function createErrorContainer( error:ErrorResponse, user:User ) {
  const location = error.path ? ` · \`${error.path.join( ` ` )}\`` : ``

  return new ContainerBuilder()
    .setAccentColor( ERROR_COLOR )
    .addTextDisplayComponents( text => text.setContent( `**${error.title}** · ${error.description}\n-# <@${user.id}>${location}` ) )
}

/**
 * ┃ ### ⚙️ Help for commands
 * ┃ The scope's description
 * ┃ ───
 * ┃ **Groups**
 * ┃ `cc! fun …`
 * ┃ -# its description
 * ┃ ───
 * ┃ **Commands**
 * ┃ `cc! random [from] [to]`
 * ┃ -# its description
 * ┃ ─── (the legend, on the main page only)
 * ┃ -# `<parameter>` is required
 * ┃ -# `[parameter]` is optional
 * ┃ -# `<parameter…>` takes the rest of the message
 * ┃ -# Add `?` at the end of a command to see its description and parameters
 * ┃ ───
 * ┃ -# @User · `cc!`
 */
function createHelpContainer( help:HelpResponse, user:User ) {
  const commandPath = (help.prefix + help.path.join( ` ` )).trimEnd()
  const header = [ `### ${help.title}`, help.description ].filter( Boolean ).join( `\n` )
  const footer = `-# <@${user.id}> · \`${commandPath}\``

  // The notation and how to see a single command's help are explained once, on the main page
  const legend = help.path.length ? `` : [ ...help.notes, help.commandHelpTip ].map( line => `-# ${line}` ).join( `\n` )

  const sections = [
    help.scopes.length ? `**${help.labels.scopes}**\n` + help.scopes.map( scope => formatEntry( commandPath, scope, ` …` ) ).join( `\n` ) : ``,
    help.commands.length ? `**${help.labels.commands}**\n` + help.commands.map( command => formatEntry( commandPath, command ) ).join( `\n` ) : ``,
  ].filter( Boolean )

  if (!sections.length) sections.push( `-# ${help.labels.nothing}` )

  const container = new ContainerBuilder()
    .setAccentColor( HELP_COLOR )
    .addTextDisplayComponents( text => text.setContent( header ) )

  let availableLength = TEXT_LIMIT - header.length - legend.length - footer.length

  for (const section of sections) {
    const fittedSection = fitLength( section, availableLength )
    availableLength -= fittedSection.length

    addSeparator( container ).addTextDisplayComponents( text => text.setContent( fittedSection ) )
  }

  if (legend) addSeparator( container ).addTextDisplayComponents( text => text.setContent( legend ) )

  return addSeparator( container ).addTextDisplayComponents( text => text.setContent( footer ) )
}

/**
 * ┃ ### ⚙️ Help for commands
 * ┃ `cc! storm [area]`
 * ┃ The command's description
 * ┃ ───
 * ┃ **Parameters**
 * ┃ `area` · **optional** · default `poland`
 * ┃ -# its description
 * ┃ ───
 * ┃ -# @User · `cc! storm`
 */
function createCommandHelpContainer( help:CommandHelpResponse, user:User ) {
  const commandPath = (help.prefix + help.path.join( ` ` )).trimEnd()
  const usage = [ commandPath, ...help.params.map( formatParam ) ].join( ` ` )
  const header = [ `### ${help.title}`, `\`${usage}\``, help.description ].filter( Boolean ).join( `\n` )
  const footer = `-# <@${user.id}> · \`${commandPath}\``

  const container = new ContainerBuilder()
    .setAccentColor( HELP_COLOR )
    .addTextDisplayComponents( text => text.setContent( fitLength( header, TEXT_LIMIT / 2 ) ) )

  if (help.params.length) {
    const params = `**${help.labels.params}**\n` + help.params.map( param => describeCommandParam( help, param ) ).join( `\n` )
    addSeparator( container ).addTextDisplayComponents( text => text.setContent( fitLength( params, TEXT_LIMIT / 2 - footer.length ) ) )
  }

  return addSeparator( container ).addTextDisplayComponents( text => text.setContent( footer ) )
}

/** `area` · **optional** · default `poland`, then the description in small text below, line by line */
function describeCommandParam( help:CommandHelpResponse, param:CommandHelpParam ) {
  const kinds = [ param.optional ? help.labels.optional : help.labels.required, param.rest ? help.labels.rest : `` ].filter( Boolean ).join( `, ` )
  const defaultValue = param.defaultValue === null ? `` : ` · ${help.labels.default} \`${param.defaultValue}\``
  const descriptionLines = param.description ? param.description.split( `\n` ).map( line => `-# ${line}` ) : []

  return [ `\`${param.name}\` · **${kinds}**${defaultValue}`, ...descriptionLines ].join( `\n` )
}

function addSeparator( container:ContainerBuilder ) {
  return container.addSeparatorComponents( separator => separator.setSpacing( SeparatorSpacingSize.Small ) )
}

/** `cc! random [from] [to]`, with the description in small text below */
function formatEntry( commandPath:string, entry:HelpEntry, suffix = `` ) {
  const usage = [ commandPath, entry.name, ...entry.params.map( formatParam ) ].join( ` ` ) + suffix
  if (!entry.description) return `\`${usage}\``

  return `\`${usage}\`\n-# ${entry.description.replace( /\n/g, ` ` )}`
}

/** `<required>`, `[optional]`, `<rest…>` */
function formatParam( param:HelpParam ) {
  const name = param.rest ? `${param.name}…` : param.name
  if (param.optional) return `[${name}]`

  return `<${name}>`
}

/** Cuts whole lines off the end, so a long list stays within Discord's limit */
function fitLength( text:string, maxLength:number ) {
  if (text.length <= maxLength) return text

  const lines = text.split( `\n` )
  while (lines.length > 1 && lines.join( `\n` ).length + TRUNCATION_MARK.length > maxLength) lines.pop()

  return lines.join( `\n` ) + TRUNCATION_MARK
}
