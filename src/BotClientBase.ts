import fs from "fs/promises"
import Logger, { LoggerPart } from "./logger/index.js"
import formatDate from "./logger/formatDate.js"
import GuildDataset, { Config } from "./GuildDataset.js"
import { Scope } from "./CommandProcessor.js"


export const __APPDIRNAME = await fs.realpath( `.` )

export type BotBaseConfig = {
  defaultPrefix?: string
  defaultPrefixSpace?: boolean
  logMaxLength?: number
}


export default class BotClientBase<TClient, TGuild> {
  #initialized = false
  #appClient?: TClient
  #guildsDatasets = new Map<string, GuildDataset<TGuild>>()

  static loggers = {
    system: new Logger( [
      { color:`fgBlack`, value:() => formatDate( Date.now(), `[hh:mm:ss:ms] ` ) },
      { color:`fgRed`, value:`System` },
      { color:`fgBlack`, value:` : ` },
      { color:`fgWhite` },
    ] as const satisfies readonly LoggerPart[], { separated:true } ),

    server: new Logger( [
      { color:`fgBlack`, value:() => formatDate( Date.now(), `[hh:mm:ss:ms] ` )  },
      { color:`fgBlue`, minLength:20, maxLength:20, align:`right` },    // Server name
      { color:`fgBlack`, value:` :: ` },
      { color:`fgBlue`, minLength:15, maxLength:15 },                   // Channel name
      { color:`fgYellow`, minLength:10, maxLength:10, align:`right` },  // Nickname
      { color:`fgBlack`, value:`: ` },
      { color:`fgBlue`, minLength:10, maxLength:10 },                   // Action type
      { color:`fgBlack`, value:` | ` },
      { color:`fgWhite` },                                              // Message
    ] as const satisfies readonly LoggerPart[], { maxLineLength:100 } ),
  }

  #config = {
    defaultPrefix: `cc!`,
    defaultPrefixSpace: true,
    logMaxLength: 170,
    externalVars: {},
    idOfGuildToCopy: ``,
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

    if (`idOfGuildToCopy` in config && typeof config.idOfGuildToCopy === `string`) {
      this.#config.idOfGuildToCopy = config.idOfGuildToCopy
    }
  }


  log( data, type?:string ) {
    // this.#loggers.guild.log( data )
  }


  async loadModule( modulePath:string ): Promise<string | void> {
    if (!modulePath) return `Module path not provided`

    const guildId = modulePath.match( /([^-]+)--(.*)$/ )?.[ 1 ]

    if (!guildId) return `Wrong module path (guild id not found)`

    const guildDataset = this.guildsDatasets.get( guildId )

    if (!guildDataset) return `Guild dataset not found`

    const configCode = await fs.readFile( `${__APPDIRNAME}/${modulePath}`, { encoding:`utf-8` } )
    // const importsAndStartingCommentsTrimmer = /(?:(?:import |\/\/|\/\*[\s\S]*?\*\/).*\r?\n)*([\s\S]*)/

    try {
      // TODO Loading every script (unsafe too; with infinite loops etc) and validate its return object
      // const script = configCode.match( importsAndStartingCommentsTrimmer )?.[ 1 ]
      // let scriptReturnValue =  new VM2Package.VM( this.vmConfig ).run( `(() => {${script}})()` ) ?? {}

      let scriptReturnValue = eval( `(() => {${configCode}})()` ) ?? {}
      let error:Error | null = null

      if (!(scriptReturnValue instanceof Config) || Array.isArray( scriptReturnValue )) {
        scriptReturnValue = new Config({})
        error = new Error( `Config return datatype is not an object!` )
      }

      const config = scriptReturnValue?.data

      if (!config.prefix) config.prefix = this.#config.defaultPrefix
      if (!config.commands) config.commands = new Scope( {}, {} )

      config.commands.setSafety( false )
      config.commands.merge( BotClientBase.predefinedCommands, true )

      guildDataset.loadConfig( scriptReturnValue )

      if (error) throw error
    } catch (err) {
      console.error( err )

      if (err instanceof Error) {
        return err.message
      }
    }
  }


  createGuild = async(guildId:string, guildName:string, guild:TGuild) => {
    const path = `./guild_configs/${guildId}--${guildName.slice( 0, 20 ).replace( / /g, `-` )}${guildName.length > 20 ? `...` : ``}/`
    const configPath = `${path}config.js`
    const idOfGuildToCopy = this.#config.idOfGuildToCopy

    this.guildsDatasets.set( guildId, new GuildDataset( guildName, guild ) )
    // this.guildsDatasets.set( guildId, new GuildDataset( guildName, guild, this.loggers.guild, this.eventBinder ) )

    const pathExists = await fs.access( path ).then( () => true ).catch( () => false )
    if (!pathExists) fs.mkdir( path )

    const configExists = await fs.access( configPath ).then( () => true ).catch( () => false )
    if (!configExists && idOfGuildToCopy) {
      if (idOfGuildToCopy !== guildId) {
        const configToCopyFolderPath = await fs.readdir( path ).then( filenames =>
          filenames.filter( filename => filename.split( `--` )[ 0 ] === idOfGuildToCopy )[ 0 ],
        )

        await fs.copyFile( `${configToCopyFolderPath}config.js`, configPath )
      } else {
        await fs.writeFile( configPath, `` )
      }
    }

    const error = await this.loadModule( configPath )

    if (this.#initialized) this.log( `I have joined to guild named [fgYellow]${guildName}[]`, `info` )
    else {
      let message = `I'm on guild named [fgYellow]${guildName}[]`

      if (error) message += `\n[fgRed]CONFIG LOADING ERROR[]: ${error}`

      this.log( message )
    }
  }


  endInitialization() {
    this.#initialized = true

    console.log()

    this.log( `I have been started!` )
  }


  static predefinedCommands = new Scope( {}, {} )
}
