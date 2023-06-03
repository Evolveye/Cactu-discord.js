import Namespace from "src/Namespace.js"
import Discord, { REST, ActivityType, ChannelType, Partials } from "discord.js"
import { Executor, Scope } from "./src/moduleStructure/index.js"
import { CommandPermissionsError, CommandError, ProcessorResponseHandlerParam, ExecutionError, MissingExecutionParameter, WrongExecutionParameter, OverlimitedExecutorParameter, NoCommandError, RuntimeExecutionError } from "./src/CommandProcessor/index.js"
import BotBase, { BotBaseConfig } from "./src/BotClientBase.js"

export * from "./src/moduleStructure/index.js"

export type TranslationKeys =
  | `err.noPath`
  | `err.noPerms`
  | `err.noParam`
  | `err.badParam`
  | `err.tooManyParams`
  | `err.tooManyParamsUnnecessaryParam`
  | `err.invalidCommand`
  | `err.error`
  | `err.noAttachment`
  | `help.title`
  | `help.showDescription`
  | `help.optionalParam`
  | `help.restParam`
  | `label.commands`
  | `label.scopes`
  | `label.providedValue`
  | `label.parameter`
  | `label.optional`
  | `label.rest`
  | `label.mask`
  | `label.yes`
  | `label.no`
  | `system.loadSuccess`

export type ExecutorFnParam = {
  ns: Namespace<ExecutorFnParam>
  msg: Discord.Message
  send: (msg:string) => (Promise<Discord.Message<false>> | Promise<Discord.Message<true>>)
  sendOk: (msg:string) => (Promise<Discord.Message<false>> | Promise<Discord.Message<true>>)
  deleteMsg: () => Promise<Discord.Message<boolean>>
  getWebHook: (channel:Discord.Channel) => Promise<null | Discord.Webhook>
}

export class DCExecutor extends Executor<ExecutorFnParam> {}

type Config = BotBaseConfig & {
  appOwnerId?: string
  botToken: string
  appId: string
}

export default class CactuDiscordBot extends BotBase<ExecutorFnParam> {
  client: Discord.Client
  rest: REST
  ownerId: undefined | string = undefined

  constructor( config:Config ) {
    super()

    if (!config?.botToken) throw new Error( `Config object have to have "botToken" field` )
    if (config.appOwnerId) this.ownerId = config.appOwnerId

    this.rest = new REST().setToken( config.botToken )
    this.client = new Discord.Client({
      intents: (2 ** 22 - 1), // All intents
      partials: [ Partials.Channel, Partials.Message ],
    })

    this.client
      // .on( `messageCreate`, () => console.log( `msg` ) )
      .on( `messageCreate`, this.handleMessage )
      // .on( `messageUpdate`, this.onMessageUpdate )
      .on( `guildCreate`, this.handleGuild )
      .on( `guildDelete`, ({ name }) => this.logSystem( `I left from guild named [fgYellow]${name}[]` ) )
      .on( `ready`, this.onReady )
      .login( config.botToken )
      .catch( err => this.logSystem( `I can't login in.\n${err}` ) )
  }


  getGuildNamespace = (message:Discord.Message) => {
    const { guild, author } = message

    const id = guild
      ? guild.id
      : author
        ? author.client.guilds.cache.find( ({ id }) => this.client.guilds.cache.has( id ) )?.id
        : null

    if (!id || !author || (author.bot && author.id === this.client.user?.id)) return

    return this.namespacesData.get( id )
  }


  handleMessage = (message:Discord.Message) => {
    if (!message.content) return

    const msgType = message.channel.type

    switch (msgType) {
      case ChannelType.GuildText: {
        this.logServer( message.guild?.name ?? `- - -`, message.channel.name, message.author.username, `Message`, message.content )
        break
      }

      case ChannelType.DM: {
        this.logDM( message.channel.recipient?.username ?? message.channel.recipientId, message.author.username, `Message`, message.content )
        break
      }
    }

    const guildNamespace = this.getGuildNamespace( message )

    guildNamespace?.processMessage({
      message: message.content,
      processFilters: false,
      checkPermissions: perms => this.checkPermissions( perms, message ),
      executorDataGetter: () => ({
        ns: guildNamespace,
        msg: message,
        send: (msg:string) => message.channel.send( msg ),
        sendOk: (msg:string) => message.channel.send( `✅ ${msg}` ),
        deleteMsg: () => message.delete(),
        getWebHook: (channel?:Discord.Channel) => this.getWebHook( channel ?? message.channel ),
      }),
      handleResponse: response => this.handleResponse( response, guildNamespace.config.compoundModule.translation, message ),
    })
  }


  checkPermissions = (perms:string[], message:Discord.Message) => {
    if (perms.includes( `_NOBODY` )) return false
    if (message.author.bot) return perms.includes( `_BOT` )

    if (!perms.length) return true
    if (message.author.id === this.ownerId) return true
    if (perms.includes( message.author.id )) return true
    if (perms.includes( `!` + message.author.id )) return false

    const { member } = message

    if (member) {
      const roleNames = member.roles.cache.map( r => [ r.name, r.id ] ).flat() ?? []
      const PermFlags = Discord.PermissionsBitField.Flags

      if (perms.some( p => roleNames.includes( p ) )) return true
      if (perms.includes( `_ADMIN` ) && member.permissions.has( PermFlags.Administrator )) return true
    }

    return false
  }


  handleResponse = (response:ProcessorResponseHandlerParam, translation:Partial<Record<TranslationKeys, string>>, message:Discord.Message) => {
    if (response instanceof Error) {
      const embed = {
        color: 0xb7603d,
        description: ``,
        footer: {
          text: (message.member?.displayName ?? message.author.username),
          icon_url: message.author.displayAvatarURL(),
        },
      }

      if (response instanceof CommandError) {
        embed.footer.text += ` :: ` + response.path.join( ` ` )

        if (response instanceof NoCommandError) embed.description = translation[ `err.noPath` ] ?? `No command`
        else if (response instanceof CommandPermissionsError) embed.description = translation[ `err.noPerms` ] ?? `You have no permissions to do this`
      } else if (response instanceof ExecutionError) {
        if (response instanceof MissingExecutionParameter) embed.description = translation[ `err.noParam` ] ?? `Missing parameter`
        else if (response instanceof WrongExecutionParameter) embed.description = translation[ `err.badParam` ] ?? `Bad parameter`
        else if (response instanceof OverlimitedExecutorParameter) embed.description = translation[ `err.tooManyParams` ] ?? `Too many parameters`
        else if (response instanceof RuntimeExecutionError) embed.description = translation[ `err.invalidCommand` ] ?? `This command have invalid code`
      }

      embed.description = `**` + (translation[ `err.error` ] ?? `Error`) + `** :: ` + embed.description

      message.channel.send({ embeds:[ embed ] })
      return
    }

    if (response.typeInstance instanceof Scope) {
      const path = response.path.join( ` ` ) + ` `
      const scopeItems = response.typeInstance.getItemsInfo()

      const scopesFields:Discord.APIEmbedField[] = []
      const esecutorsFields:Discord.APIEmbedField[] = []
      const fields:Discord.APIEmbedField[] = []

      for (const item of scopeItems) {
        if (item.type === `scope`) scopesFields.push({
          name: path + `***` + item.name + `*** ...`,
          value: item.shortDescription ?? ``,
          inline: true,
        })

        if (item.type === `executor`) esecutorsFields.push({
          name: path + `***` + item.name + `***`,
          value: item.shortDescription ?? ``,
          inline: true,
        })
      }

      if (scopesFields.length) fields.push(
        { name:``, value:translation[ `label.scopes` ] ?? `Scopes` },
        ...scopesFields,
      )

      if (esecutorsFields.length) fields.push(
        { name:scopeItems.length ? `\u200b` : ``, value:translation[ `label.commands` ] ?? `Commands` },
        ...esecutorsFields,
      )

      const embed:Discord.APIEmbed = {
        color: 0x4ee910,
        title: translation[ `help.title` ] ?? `⚙️ Help for commands`,
        description: ``,
        fields,
        footer: {
          text: (message.member?.displayName ?? message.author.username) + ` :: ` + response.path.join( ` ` ),
          icon_url: message.author.displayAvatarURL(),
        },
      }

      message.channel.send({ embeds:[ embed ] })

      return
    }
  }


  handleGuild = (guild:Discord.Guild) => {
    const parsedName = guild.name.slice( 0, 20 ).replace( / [^ ]/g, match => match.trim().toUpperCase() ).trim() + (guild.name.length > 20 ? `...` : ``)
    this.registerNamespace( guild.id, {
      name: guild.name,
      folderName: guild.id + `--` + parsedName,
    } )
  }


  onReady = () => {
    this.client.guilds.cache.forEach( guild => this.handleGuild( guild ) )
    this.client.user?.setActivity({ name:`My pings`, type:ActivityType.Watching })

    this.endInitialization()
  }


  async getWebHook( channel:Discord.Channel ) {
    if (channel.type !== Discord.ChannelType.GuildText) return null

    const hooks = await channel.fetchWebhooks().catch( console.log ).then( hook => hook ?? null )
    const existingCactuHook = hooks?.find( ({ name }) => name == `CactuHaczyk` )

    if (existingCactuHook) return existingCactuHook

    const cactuHook = await channel.createWebhook({ name:`CactuHaczyk`, avatar:`https://cdn.discordapp.com/avatars/379234773408677888/a062f0b67e42116104554c1d3e3b695f.png?size=2048` })
      .catch( console.log ).then( hook => hook ?? null )

    return cactuHook
  }
}
