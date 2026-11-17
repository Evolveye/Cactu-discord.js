import { ActivityType, Client, GatewayIntentBits, Partials, REST } from "discord.js"
import BotClientBase from "../core/BotClientBase.js"
import { getWebHook } from "./webhooks.js"
import DiscordModules from "./modules/DiscordModules.js"
import { registerGlobalSlashCommands } from "./handlers/slashCommands.js"
import { handleMessage } from "./handlers/messages.js"
import { handleInteraction } from "./handlers/interactions.js"
import { handleGuildCreate, handleGuildDelete } from "./handlers/guilds.js"
import type { Channel, ThreadChannel } from "discord.js"
import type { BotBaseConfig } from "../core/BotClientBase.js"
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

  /** Global modules (`modules/`) and their assignment to guild namespaces (`namespaces/<guild id>/namespace.json`) */
  modules = new DiscordModules( this )

  constructor( config:Config ) {
    super( config )

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



  #handleReady() {
    this.client.user?.setActivity({ name:`Growing plants`, type:ActivityType.Watching })

    this.modules.loadGlobalModules()
      .then( () => Promise.allSettled( this.client.guilds.cache.map( guild => handleGuildCreate( this, guild ) ) ) )
      .then( () => this.#startHttpServer() )
      .then( () => registerGlobalSlashCommands( this ) )

    this.endInitialization()
  }

  #startHttpServer() {
    if (!this.http) return this.logSystem( `I have no HTTP server ([fgYellow]http[] isn't in my config)` )

    return this.http.listen().catch( (error:Error) => this.logSystem( `[fgRed]The HTTP server didn't start[]: ${error.message}` ) )
  }
}
