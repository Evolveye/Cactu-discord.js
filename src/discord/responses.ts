import { describeResponse } from "../core/responses.js"
import type { APIEmbed, APIEmbedField, APIInteractionGuildMember, GuildMember, TextBasedChannel, User } from "discord.js"
import type { ErrorResponse, HelpParam, HelpResponse } from "../core/responses.js"
import type { Namespace, ProcessorResponseHandlerParam } from "../core/namespaceStructure/index.js"
import type DCModule from "./DiscordModule.js"
import type CactuDiscordBot from "./DiscordBot.js"

export type ResponseTarget = {
  channel: null | TextBasedChannel
  member: null | GuildMember | APIInteractionGuildMember
  user: User
}

const ERROR_COLOR = 0xb7603d
const HELP_COLOR = 0x4ee910
const EMPTY_TEXT = `​`
const SCOPES_PER_ROW = 3

export function sendResponse( bot:CactuDiscordBot, response:ProcessorResponseHandlerParam, namespace:Namespace<DCModule>, { channel, member, user }:ResponseTarget ) {
  const { translation, prefix } = namespace.getCompoundModule()

  const content = describeResponse( response, translation, prefix )
  if (!content) return

  if (content.type === `error` && content.runtimeError) bot.logSystem( `[fgRed]ERR[]: ${content.runtimeError}` )
  if (!channel?.isSendable()) return

  const username = member && `displayName` in member ? member.displayName : user.username
  const footer = { text:username, icon_url:user.displayAvatarURL() }
  const embed = content.type === `error` ? createErrorEmbed( content, footer ) : createHelpEmbed( content, footer )

  channel.send({ embeds:[ embed ] })
}

function createErrorEmbed( error:ErrorResponse, footer:{ text: string, icon_url: string } ): APIEmbed {
  return {
    color: ERROR_COLOR,
    description: `**${error.title}** :: ${error.description}`,
    footer: { ...footer, text:error.path ? `${footer.text} :: ${error.path.join( ` ` )}` : footer.text },
  }
}

function createHelpEmbed( help:HelpResponse, footer:{ text: string, icon_url: string } ): APIEmbed {
  const commandPath = help.prefix + help.path.join( ` ` )
  const scopesFields:APIEmbedField[] = help.scopes.map( scope => ({ name:`${commandPath}  ***${scope.name}*** \`...\``, value:scope.description, inline:true }) )
  const commandsFields:APIEmbedField[] = help.commands.map( command => ({
    name: `${commandPath}  ***${command.name}*** ${command.params.map( formatParam ).join( `` )}`,
    value: command.description,
    inline: false,
  }) )

  // Fill the last row of the inline scopes grid, so the commands start below it
  if (scopesFields.length) for (let i = 0;  i < SCOPES_PER_ROW - ((scopesFields.length + 1) % SCOPES_PER_ROW);  i++) scopesFields.push({ name:EMPTY_TEXT, value:EMPTY_TEXT, inline:true })

  const fields:APIEmbedField[] = []

  if (scopesFields.length) fields.push( { name:``, value:help.labels.scopes }, ...scopesFields )
  if (commandsFields.length) fields.push( { name:EMPTY_TEXT, value:help.labels.commands }, ...commandsFields )
  if (!scopesFields.length && !commandsFields.length) fields.push({ name:EMPTY_TEXT, value:help.labels.nothing, inline:false })

  return {
    color: HELP_COLOR,
    title: help.title,
    description: help.notes.map( note => `* ${note}` ).join( `\n` ),
    fields,
    footer: { ...footer, text:`${footer.text} :: ${commandPath}` },
  }
}

function formatParam( param:HelpParam ) {
  return `  **\` ${param.rest ? `...` : ``}${param.name}${param.optional ? `?` : ``} \`**  `
}
