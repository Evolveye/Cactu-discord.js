import Discord, { Intents } from "discord.js"
import BotBase, { BotBaseConfig } from "./src/BotClientBase.js"

type Config = BotBaseConfig & {
  token: string
}

export default class CactuDiscordBot extends BotBase<Discord.Client> {
  constructor( config:Config ) {
    super( new Discord.Client({ intents:[ Intents.FLAGS.GUILDS ] }) )

    this.appClient
      .on( `message`, this.handleMessage )
      .on( `ready`, this.onReady )
      // .on( `messageUpdate`, this.onMessageUpdate )
      // .on( `guildCreate`, this.onGuildCreate )
      .on( `guildDelete`, ({ name }) => this.log( `I left from guild named [fgYellow]${name}[]` ) )
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


  onReady = () => {
    // this.appClient.guilds.cache.forEach( guild => this.onGuildCreate( guild ) )
    this.appClient.user?.setActivity({ name:`my pings`, type:`WATCHING` })

    this.endInitialization()
  }
}
