import { ActivityType, Client, GatewayIntentBits, Partials, REST } from "discord.js"
import BotClientBase from "../core/BotClientBase.js"
import { getWebHook } from "./webhooks.js"
import { registerGlobalSlashCommands } from "./handlers/slashCommands.js"
import { handleMessage } from "./handlers/messages.js"
import { handleInteraction } from "./handlers/interactions.js"
import { handleGuildCreate, handleGuildDelete } from "./handlers/guilds.js"
import type { Channel, Guild, ThreadChannel } from "discord.js"
import type { BotBaseConfig, NamespaceInfo } from "../core/BotClientBase.js"
import type { GlobalCommandData } from "./handlers/slashCommands.js"
import type DCModule from "./DiscordModule.js"

export type Config = BotBaseConfig & {
  appOwnerId?: string
  botToken: string
  appId: string
}

/** The privileged ones (members, presences, message content) have to be enabled in the Developer Portal */
const ALL_INTENTS = Object.values( GatewayIntentBits ).filter( (bit): bit is GatewayIntentBits => typeof bit === `number` )

/** One namespace per guild */
export default class CactuDiscordBot extends BotClientBase<DCModule> {
  client: Client
  rest: REST
  ownerId: undefined | string = undefined
  globals = {
    commands: new Map<string, GlobalCommandData>(),
  }

  constructor( config:Config ) {
    super()

    if (!config?.botToken) throw new Error( `Config object have to have "botToken" field` )
    if (config.appOwnerId) this.ownerId = config.appOwnerId

    this.rest = new REST().setToken( config.botToken )
    this.client = new Client({
      intents: ALL_INTENTS,
      partials: [ Partials.Channel, Partials.Message ],
    })

    this.client
      .on( `clientReady`, () => this.#handleReady() )
      .on( `guildCreate`, guild => handleGuildCreate( this, guild ) )
      .on( `guildDelete`, guild => handleGuildDelete( this, guild ) )
      .on( `messageCreate`, message => handleMessage( this, message ) )
      .on( `interactionCreate`, interaction => handleInteraction( this, interaction ) )
      .login( config.botToken )
      .catch( err => this.logSystem( `I can't login in.\n${err}` ) )
  }


  getWebHook( channel:null | Channel | ThreadChannel ) {
    return getWebHook( channel )
  }

  getGuildFolderName( guild:Guild ) {
    const parsedName = guild.name.slice( 0, 20 ).replace( / [^ ]/g, match => match.trim().toUpperCase() ).trim() + (guild.name.length > 20 ? `...` : ``)
    return guild.id + `--` + parsedName
  }

  async getGuildStorage( guild:undefined | null | Guild ) {
    if (!guild) return undefined
    return this.getNamespaceFileStorage( this.getGuildFolderName( guild ) )
  }

  getNamespaceInfoFromGuild( guildId:string ): null | NamespaceInfo<DCModule>
  getNamespaceInfoFromGuild( guild:Guild ): null | NamespaceInfo<DCModule>
  getNamespaceInfoFromGuild( guildOrItsId:string | Guild ): null | NamespaceInfo<DCModule> {
    const guild = typeof guildOrItsId === `string` ? this.client.guilds.cache.get( guildOrItsId ) : guildOrItsId
    if (!guild) return null

    return super.getNamespaceInfo( this.getGuildFolderName( guild ), guild.id )
  }


  #handleReady() {
    this.client.user?.setActivity({ name:`Growing plants`, type:ActivityType.Watching })

    Promise.allSettled( this.client.guilds.cache.map( guild => handleGuildCreate( this, guild ) ) )
      .then( () => registerGlobalSlashCommands( this ) )

    this.endInitialization()
  }
}
