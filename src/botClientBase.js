import fs from "fs"
import https from "https"

import VM2Package from "vm2"

import { Scope as _Scope, Executor as _Executor } from "./CommandProcessor.js"
import Logger, { logUnderControl } from "./Logger.js"
import GuildDataset, { Config } from "./GuildDataset.js"
import { Filter as _Filter } from "./FiltersProcessor.js"

export { GuildDataset, Config,  Logger, logUnderControl }
export * from "./processedDiscordData.js"

/** @typedef {import("./src/GuildDataset.js").GuildModuleTranslation} GuildModuleTranslation */
/** @typedef {import("./src/CommandProcessor.js").CommandState} CommandState */
/** @typedef {import("./src/CommandProcessor.js").CommandError} CommandError */
/** @typedef {import("./src/CommandProcessor.js").Command} Command */

/** @typedef {"@everyone" | "@bot_owner" | "@dm" | "@server_admin" | "@bot" | "@<user id>" | "<role name or ID>"} Permission */

/** @typedef {{}} DiscordCommandElementMetaPart */

/** @typedef {CommandState & DiscordCommandElementMetaPart} DiscordCommandState */

/**
 * @typedef {object} Variables
 * @property {ProcessedMessage} message
 * @property {Discord.Message} [nativeMessage] Only for safe uage
 * @property {GuildDataset} [guildDataset] Only for safe uage
 * @property {CactuDiscordBot} [bot] Only for safe uage
 * @property {(message:string) => Promise<ProcessedMessage>} response
 * @property {(message:string) => Promise<ProcessedMessage>} sendOk
 * @property {(message:string) => Promise<ProcessedMessage>} sendErr
 */

/**
 * @typedef {Object} CactuDiscordBotConfig
 * @property {string} token
 * @property {string} [prefix]
 * @property {boolean} [prefixSpace]
 * @property {Object<string,*>} [publicVars]
 * @property {{ok:string,warn:string,error:string}} [signs]
 * @property {number} [logMaxLength]
 * @property {Discord.Snowflake} [botOwnerId]
 */


/** @extends {_Scope<DiscordCommandElementMetaPart,Permission,Variables>} */
export class Scope extends _Scope {}


/** @extends {_Executor<DiscordCommandElementMetaPart,Permission,Variables>} */
export class Executor extends _Executor {}

/** @extends {_Filter<Variables & { match:any }>} */
export class Filter extends _Filter {}

export const __DIRNAME = import.meta.url.match( /(.*)\// )[ 1 ].slice( 8 )
export const __APPDIRNAME = fs.realpathSync( `.` )


if (!fs.existsSync( `./guild_configs/` )) fs.mkdirSync( `./guild_configs/` )


/**
 * @template TClient
 * @template TGuild
 */
export default class BotClientBase {
  initialized = false
  /** @type {T} */
  appClient = null

  /** @type {Map<string,GuildDataset>} */
  guildsDatasets = new Map()
  vmConfig = {
    eval: false,
    wasm: false,
    require: false,
    nesting: false,
    fixAsync: true,
    timeout: 10,
    wrapper: `none`,
    sandbox: { Config, Scope, Executor, Filter },
  }
  loggers = {
    guild: new Logger( [
      { color:`white`,   value:`[{hh}:{mm}:{ss}] ` },             // "[hh:mm:ss] "
      { color:`magenta`, align:`right`, length:24, maxLen:24 },   // Guild name
      { color:`white`,   value:` :: ` },                          // " :: "
      { color:`magenta`, align:`left`,  length:20, maxLen:20 },   // Channel name
      { color:`white`,   value:` :: ` },                          // " :: "
      { color:`blue`,    align:`right`, length:7 },               // /(Filter|Command)/
      { color:`white`,   value:`: ` },                            // ": "
      { color:`yellow`,  align:`right`, length:15, maxLen:25 },   // Member display name
      { color:`white`,   value:`: ` },                            // ": "
      { color:`white`,   splitLen:this.logMaxLength, firstSplitLen:(this.logMaxLength - 80) }, // Message
    ], { separateBreakBlock:true, newLinePrefix:`   -  -  | ` } ),
    dm: new Logger( [
      { color:`white`,   value:`[{hh}:{mm}:{ss}] ` },             // "[hh:mm:ss] "
      { color:`magenta`, align:`right`, length:19 },              // Author id
      { color:`white`,   value:`#` },                             // "#"
      { color:`magenta`, length:4 },                              // Author discriminator
      { color:`white`,   value:` :: ` },                          // " :: "
      { color:`magenta`, value:`DM`, length:20 },                 // "DM"
      { color:`white`,   value:` :: ` },                          // " :: "
      { color:`blue`,    align:`right`, length:7 },               // /(Filter|Command)/
      { color:`white`,   value:`: ` },                            // ": "
      { color:`yellow`,  align:`right`, length:15, maxLen:25 },   // Member display name
      { color:`white`,   value:`: ` },                            // ": "
      { color:`white`,   splitLen:this.logMaxLength, firstSplitLen:(this.logMaxLength - 80) }, // Message
    ], { separateBreakBlock:true, newLinePrefix:`   -  -  | ` } ),
    info: new Logger( [
      { color:`white`,   value:`[{hh}:{mm}:{ss}] ` },       // "[hh:mm:ss] "
      { color:`blue`,    value:` info `, bold:true },       // " i "
      { color:`white`,   value:` ` },                       // " "
      { color:`white`,   splitLen:this.logMaxLength, firstSplitLen:(this.logMaxLength - 10) }, // Message
    ], { separateBreakBlock:true, newLinePrefix:`   -  -  | ` } ),
    system: new Logger( [
      { color:`magenta`, value:`  Bot` },                   // "Bot"
      { color:`white`,   value:`: ` },                      // ": "
      { color:`white`,   splitLen:this.logMaxLength, firstSplitLen:(this.logMaxLength - 10) }, // Message
    ], { separated:true, separateBreakBlock:false } ),
  }

  defaultPrefix = `cc!`
  defaultPrefixSpace = true
  idOfGuildToCopy = ``
  botOwnerId = ``
  logMaxLength = 170
  publicVars = {}



  /**
   * @param {T} appClient
   * @param {CactuDiscordBotConfig} config
   */
  constructor( appClient, config ) {
    console.log()
    this.log( `Initialization started!` )
    console.log()

    if (`defaultPrefix`       in config) this.defaultPrefix       = config.defaultPrefix
    if (`defaultPrefixSpace`  in config) this.defaultPrefixSpace  = config.defaultPrefixSpace
    if (`idOfGuildToCopy`     in config) this.idOfGuildToCopy     = config.idOfGuildToCopy
    if (`logMaxLength`        in config) this.logMaxLength        = config.logMaxLength
    if (`botOwnerId`          in config) this.botOwnerId          = config.botOwnerId
    if (`publicVars`          in config) this.publicVars          = config.publicVars

    this.appClient = appClient
  }


  /** @param {string} moduleName */
  loadModule = moduleFolder => {
    if (!moduleFolder) return

    const guildId = moduleFolder.match( /(\d{18})--(.*)$/ )[ 1 ]
    const guildDataset = this.guildsDatasets.get( guildId )

    if (guildDataset) {
      const configCode = fs.readFileSync( `${__APPDIRNAME}/${moduleFolder}`, { encoding:`utf-8` } )
      const importsAndStartingCommentsTrimmer = /(?:(?:import |\/\/|\/\*[\s\S]*?\*\/).*\r?\n)*([\s\S]*)/

      try {
        const script = configCode.match( importsAndStartingCommentsTrimmer )[ 1 ]

        /** @type {Config} */
        let scriptReturnValue = new VM2Package.VM( this.vmConfig ).run( `(() => {${script}})()` ) ?? {}
        let error = null

        if (!(scriptReturnValue instanceof Config) || Array.isArray( scriptReturnValue )) {
          scriptReturnValue = {}
          error = new Error(`Config return datatype is not an object!`)
        }

        const config = scriptReturnValue.data

        if (!config.prefix) config.prefix = this.defaultPrefix
        if (!config.commands) config.commands = new Scope( {}, {} )

        config.commands.setSafety( false )
        config.commands.merge( BotClientBase.predefinedCommands, true )

        guildDataset.loadConfig( scriptReturnValue )

        if (error) throw error
      } catch (err) {
        // console.error( err )
        return /** @type {Error} */ (err).message
      }
    }
  }


  clearGuildModules( guildIdToRemove, ...excludeNames ) {
    const dotPath = `${fs.realpathSync( `.` )}`

    fs.readdirSync( `${dotPath}/guilds_modules` ).forEach( filename => {
      const [ guildId ] = filename.split( `-` )

      try {
        if (!excludeNames.includes( filename ) && guildId === guildIdToRemove) fs.unlinkSync( `${dotPath}/guilds_modules/${filename}` )
      } catch (err) {
        this.log( `I can't remove module file (${filename}).` )
      }
    } )

    this.guildsData.get( guildIdToRemove ).clear()
  }


  /** @param {string} string */
  log( string, type = `system` ) {
    let logger = null

    switch (type) {
      case `info`:
        logger = this.loggers.info
        break

      case `system`:
      default:
        logger = this.loggers.system
    }

    logUnderControl( logger, string )
  }

  /**
   * @param {"command"|"filter"|"<any string>"} action
   * @param {string} guildName
   * @param {string} channelName
   * @param {string} memberName
   * @param {string} content
   */
  logAction( action, guildName, channelName, memberName, content ) {
    logUnderControl( this.loggers.guild, guildName, channelName, action, memberName, content )
  }

  /**
   * @param {TGuild} guild
   * @param {string} guildId
   * @param {string} guildName
   */
  createGuild = (guild, guildId, guildName) => {
    const path = `./guild_configs/${guildId}--${guildName.slice( 0, 20 ).replace( / /g, `-` )}${guildName.length > 20 ? `...` : ``}/`
    const configPath = `${path}config.js`

    this.guildsDatasets.set( guildId, new GuildDataset( this, guild, this.loggers.guild, this.eventBinder ) )

    if (!fs.existsSync( path )) fs.mkdirSync( path )

    if (!fs.existsSync( configPath )) {
      if (this.idOfGuildToCopy && this.idOfGuildToCopy != guildId) {
        const configToCopyFolderPath = fs.readdirSync( path )
          .filter( filename => filename.split( `--` )[ 0 ] === this.idOfGuildToCopy )[ 0 ]

        fs.copyFileSync( `${configToCopyFolderPath}config.js`, configPath )
      } else {
        fs.writeFileSync( configPath, `` )
      }
    }

    const error = this.loadModule( configPath )

    if (this.initialized) this.log( `I have joined to guild named [fgYellow]${guildName}[]`, `info` )
    else {
      let message = `I'm on guild named [fgYellow]${guildName}[]`

      if (error) message += `\n[fgRed]CONFIG LOADING ERROR[]: ${error}`

      this.log( message )
    }
  }


  endInitialization() {
    console.log()
    this.log( `I have been started!` )
    this.initialized = true
  }


  static predefinedCommands = new Scope( {}, {
    $: new Scope( { d:`Bot administration`, r:`@bot_owner` }, {
      load: new Executor( { d:`Clear all modules data and load new module from attached file`, r:`@bot_owner` }, /** @type {Variables} */ $ => {
        const { message, bot, guildDataset } = $
        const t9n = guildDataset.translation
        const attachment = message.attachments.first()
        const guildId = message.guild.id

        if (!attachment) $.sendErr( t9n.system_loadWithoutAttachment )
        if (attachment.url && !attachment.width) {
          const path = `./guild_configs/${guildId}--${message.guild.name.slice( 0, 20 ).replace( / /g, `-` )}/`
          const configPath = `${path}config.js`
          const stream = fs.createWriteStream( `${path}config.js` )

          https.get( attachment.url, res => res.pipe( stream ).on( `finish`, () => {
            stream.close()

            // bot.clearGuildModules( guildId, configPath )
            const error = bot.loadModule( configPath )

            message.delete()

            if (error) $.sendErr( error )
            else $.sendOk( t9n.system_loadSuccess )
          } ) )
        }
      } ),
      // setBotOperator: new Executor( { d:`Set the ID of bot operator` }, ($, id = /\d{18}/) => {} ),
      // getModules: new Executor( { d:`Get the guild module config files` }, $ => {} ),
    } ),
  } )
}
