type Config = {
  defaultPrefix?: string,
  defaultPrefixSpace?: boolean,
  logMaxLength?: number
}


export default class BotClientBase<TClient> {
  #initialized = false
  #appClient?:TClient
  #guildsDatasets = new Map()

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


  constructor( appClient:TClient, config:Config = {} ) {
    this.handleConfig( config )

    this.#appClient = appClient
  }


  handleConfig( config:Config ) {
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
}
