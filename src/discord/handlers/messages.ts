import { ChannelType } from "discord.js"
import { sendResponse } from "../responses.js"
import { checkPermissions } from "../permissions.js"
import type { Message } from "discord.js"
import type { ModuleCtx } from "../DiscordModule.js"
import type CactuDiscordBot from "../DiscordBot.js"
import type { ProcessorParam } from "../../core/namespaceStructure/index.js"

/** messageCreate: logs the message, then runs it through its namespace's filters and text commands */
export function handleMessage( bot:CactuDiscordBot, message:Message ) {
  if (!message.content || message.author.id === bot.client.user?.id) return

  logMessage( bot, message )

  const namespace = findMessageNamespace( bot, message )
  if (!namespace) return

  const processorParam:ProcessorParam<ModuleCtx> = {
    message: message.content,
    checkPermissions: perms => checkPermissions( perms, message, bot.ownerId ),
    executorDataGetter: () => ({
      bot,
      ns: namespace,
      msg: message,
      member: message.member,
      channel: message.channel,
      send: async msg => message.channel.isSendable() ? message.channel.send( msg ) : null,
      sendOk: async msg => message.channel.isSendable() ? message.channel.send( `✅ ${msg}` ) : null,
      getStorage: () => bot.getGuildStorage( message.guild ),
      deleteMsg: () => message.delete(),
      runCmd: command => namespace.processMessage({ ...processorParam, checkPermissions:() => true, message:command, prefix:null }),
      getWebHook: channel => bot.getWebHook( channel ?? message.channel ),
    }),
    handleResponse: response => sendResponse( bot, response, namespace, { channel:message.channel, member:message.member, user:message.author } ),
  }

  namespace.processMessage( processorParam )
}

function logMessage( bot:CactuDiscordBot, message:Message ) {
  const { channel, author, content } = message

  if (channel.type === ChannelType.GuildText) bot.logServer( message.guild?.name ?? `- - -`, channel.name, author.username, `Message`, content )
  else if (channel.type === ChannelType.DM) bot.logDM( channel.recipient?.username ?? channel.recipientId, author.username, `Message`, content )
}

/** The namespace of the message's guild; private messages use the first guild the bot is in */
function findMessageNamespace( bot:CactuDiscordBot, message:Message ) {
  const guildId = message.guild?.id ?? bot.client.guilds.cache.first()?.id
  if (!guildId) return

  return bot.namespacesData.get( guildId )
}
