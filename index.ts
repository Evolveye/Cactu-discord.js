import Discord, { REST, ActivityType, ChannelType, Partials } from "discord.js"
import { Executor } from "./src/moduleStructure/index.js"
import { CommandPermissionsError, CommandProcessingError, ProcessorResponseHandlerParam } from "./src/CommandProcessor.js"
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
  send: (msg:string) => (Promise<Discord.Message<false>> | Promise<Discord.Message<true>>)
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


  getGuildDatasets = (message:Discord.Message) => {
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

    const guildDataset = this.getGuildDatasets( message )

    guildDataset?.processMessage({
      message: message.content,
      processFilters: false,
      checkPermissions: perms => this.checkPermissions( perms, message ),
      executorDataGetter: () => ({
        send: (msg:string) => message.channel.send( msg ),
      }),
      handleResponse: response => this.handleResponse( response, guildDataset.config.compoundModule.translation, message ),
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
    if (response instanceof CommandProcessingError) {
      const embed = {
        color: 0xb7603d,
        description: ``,
        footer: {
          text: (message.member?.displayName ?? message.author.username) + ` :: ` + response.path.join( ` ` ),
          icon_url: message.author.displayAvatarURL(),
        },
      }

      if (response instanceof CommandPermissionsError) embed.description = translation[ `err.noPerms` ] ?? `You have no permissions to do this`

      embed.description = `**` + (translation[ `err.error` ] ?? `Error`) + `** :: ` + embed.description

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
}
