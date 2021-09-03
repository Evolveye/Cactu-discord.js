import Discord, { Intents } from "discord.js"
import BotBase, { BotBaseConfig } from "./src/BotClientBase.js"

type Config = BotBaseConfig & {
  token: string
}

export default class CactuDiscordBot extends BotBase<Discord.Client, Discord.Guild> {
  constructor( config:Config ) {
    super( new Discord.Client({ intents:[ Intents.FLAGS.GUILDS ] }) )

    this.appClient
      .on( `message`, this.handleMessage )
      // .on( `messageUpdate`, this.onMessageUpdate )
      .on( `guildCreate`, this.handleGuild )
      .on( `guildDelete`, ({ name }) => this.log( `I left from guild named [fgYellow]${name}[]` ) )
      .on( `ready`, this.onReady )
      .login( config.token )
      .catch( err => this.log( `I can't login in.\n${err}` ) )
  }


  getGguildDatasets = (message:Discord.Message) => {
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

    const guildDataset = this.getGguildDatasets( message )

    guildDataset?.processMessage({
      message: message.content,
    })
  }


  handleGuild = (guild:Discord.Guild) => {
    this.createGuild( guild.id, guild.name, guild )
  }


  onReady = () => {
    this.appClient.guilds.cache.forEach( guild => this.handleGuild( guild ) )
    this.appClient.user?.setActivity({ name:`my pings`, type:`WATCHING` })

    this.endInitialization()
  }
}
