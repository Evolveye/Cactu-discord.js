import Discord, { REST, ActivityType, ChannelType, Partials } from "discord.js"
import BotBase, { BotBaseConfig } from "./src/BotClientBase.js"

export * from "./src/moduleStructure/index.js"

type Config = BotBaseConfig & {
  token: string
  appId: string
}

export default class CactuDiscordBot extends BotBase<Discord.Guild> {
  client: Discord.Client
  rest: REST

  constructor( config:Config ) {
    super()

    if (!config?.token) throw new Error( `Config object have to have "token" field` )

    this.rest = new REST().setToken( config.token )
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
      .login( config.token )
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

    return this.serversDatasets.get( id )
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
    })
  }


  handleGuild = (guild:Discord.Guild) => {
    this.createGuild( guild.id, guild.name, guild )
  }


  onReady = () => {
    this.client.guilds.cache.forEach( guild => this.handleGuild( guild ) )
    this.client.user?.setActivity({ name:`My pings`, type:ActivityType.Watching })

    this.endInitialization()
  }
}
