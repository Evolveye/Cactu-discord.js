type ProcessorParam = {
  message?: string,
  processFilters?: boolean
  processCommands?: boolean
  filtersVariablesGetter?: (matches:string[]) => void
  commandsVariablesGetter?: () => void
  performResponse?: () => void
  checkPermissions?: () => void
}

type Translation = {

}

type Filter = {

}

type Scope = {

}

type ConfigConstructorParam = {
  prefix?: string
  prefixSpace?: boolean
  translation?: Translation
  filters?: Filter[]
  commands?: Scope
  // events: any
}

export class Config {
  data

  constructor( data:ConfigConstructorParam ) {
    this.data = data
  }
}

export default class GuildDataset<T> {
  #guild:T

  name:string

  constructor( name:string, guild:T ) {
    this.name = name
    this.#guild = guild
  }


  loadConfig( config:Config ) {
    //
  }


  processMessage({ message, processFilters = true, processCommands = true, ...functions }:ProcessorParam) {
    if (processFilters) console.log( `checking filteres`, { message } )
    if (processCommands) {
      console.log( `checking commands`, { message } )
    }
  }
}
