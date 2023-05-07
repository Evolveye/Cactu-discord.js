import Discord, { ActivityType } from "discord.js"
import Logger, { LoggerPart } from "./src/logger/index.js"
import BotBase, { BotBaseConfig } from "./src/BotClientBase.js"

export * from "./src/moduleStructure/index.js"

type Config = BotBaseConfig & {
  token: string
}

export default class CactuDiscordBot extends BotBase<Discord.Client, Discord.Guild> {
  constructor( config:Config ) {
    super( new Discord.Client({
      intents: (2 ** 22 - 1), // All intents
    }) )

    if (!config?.token) throw new Error( `Config object have to have "token" field` )

    this.appClient
      // .on( `messageCreate`, () => console.log( `msg` ) )
      .on( `messageCreate`, this.handleMessage )
      // .on( `messageUpdate`, this.onMessageUpdate )
      .on( `guildCreate`, this.handleGuild )
      .on( `guildDelete`, ({ name }) => this.log( `I left from guild named [fgYellow]${name}[]` ) )
      .on( `ready`, this.onReady )
      .login( config.token )
      .catch( err => this.log( `I can't login in.\n${err}` ) )
  }


  getGuildDatasets = (message:Discord.Message) => {
    const { guild, author } = message

    const id = guild
      ? guild.id
      : author
        ? author.client.guilds.cache.find( ({ id }) => this.appClient.guilds.cache.has( id ) )?.id
        : null

    if (!id || !author || (author.bot && author.id === this.appClient.user?.id)) return

    return this.guildsDatasets.get( id )
  }


  handleMessage = (message:Discord.Message) => {
    if (!message.content) return

    this.log( message.content )

    // const guildDataset = this.getGuildDatasets( message )

    // guildDataset?.processMessage({
    //   message: message.content,
    // })
  }


  handleGuild = (guild:Discord.Guild) => {
    this.createGuild( guild.id, guild.name, guild )
  }


  onReady = () => {
    this.appClient.guilds.cache.forEach( guild => this.handleGuild( guild ) )
    this.appClient.user?.setActivity({ name:`My pings`, type:ActivityType.Watching })

    this.endInitialization()
  }
}

CactuDiscordBot.loggers.system.log( `Hello [fg Red]world world world world world world[] world world world!` )
CactuDiscordBot.loggers.server.log( `Kaktus Intranetowy`, `oaza`, `Commands /`, `Hello` )
