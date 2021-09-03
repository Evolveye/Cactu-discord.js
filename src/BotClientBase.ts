import GuildDataset from "./GuildDataset"

export type BotBaseConfig = {
  defaultPrefix?: string,
  defaultPrefixSpace?: boolean,
  logMaxLength?: number
}


export default class BotClientBase<TClient> {
  #initialized = false
  #appClient?:TClient
  #guildsDatasets = new Map<string, GuildDataset>()

  #loggers = {
    guild: null,
    dm: null,
    info: null,
    system: null,
  }

  #config = {
    defaultPrefix: `cc!`,
    defaultPrefixSpace: true,
    logMaxLength: 170,
    externalVars: {},
  }


  get appClient() {
    return this.#appClient!
  }
  get guildsDatasets() {
    return this.#guildsDatasets
  }


  constructor( appClient:TClient, config:BotBaseConfig = {} ) {
    this.handleConfig( config )

    this.#appClient = appClient
  }


  handleConfig( config:BotBaseConfig ) {
    if (`defaultPrefix` in config && typeof config.defaultPrefix === `string`) {
      this.#config.defaultPrefix = config.defaultPrefix
    }

    if (`defaultPrefixSpace` in config && typeof config.defaultPrefixSpace === `boolean`) {
      this.#config.defaultPrefixSpace = config.defaultPrefixSpace
    }

    if (`logMaxLength` in config && typeof config.logMaxLength === `number`) {
      this.#config.logMaxLength = config.logMaxLength
    }
  }


  log( data ) {
    console.log( data )
  }


  endInitialization() {
    this.#initialized = true

    console.log()

    this.log( `I have been started!` )
  }
}
