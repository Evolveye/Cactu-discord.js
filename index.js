import Discord from 'discord.js'
import fs from 'fs'

import Filters from './Filters.js'
import Commands from './Chat.js'
import Logger from "./Logger.js"

if (!fs.existsSync( `./guilds_modules/` )) fs.mkdirSync( `./guilds_modules/` )

export const LoggerClass = Logger

/**
 * @typedef {Object<string,string>} GuildModuleTranslation
 */

/**
 * @typedef {Object<string,function>} GuildModuleFilters
 */

/**
 * @typedef {Object} GuildModuleCommandsField
 * @property {string|string[]} roles
 * @property {string} desc
 * @property {RegExp[]} masks
 * @property {function|GuildModuleCommands} value
 */

/**
 * @typedef {Object<string,GuildModuleCommandsField} GuildModuleCommands
 */

/**
 * @typedef {Object} GuildModule
 * @property {GuildModuleTranslation} translation
 * @property {GuildModuleFilters} filters
 * @property {GuildModuleCommands} commands
 */

class GuildModules {
  /**
   * @param {GuildModuleTranslation} translation
   * @param {GuildModuleFilters} filters
   * @param {GuildModuleCommands} commands
   */
  constructor( translation={}, filters={}, commands={} ) {
    this.translation = translation
    this.filters = filters
    this.command = commands
  }

  /**
   * @param {GuildModule} param0
   */
  include( { translation, filters, commands } ) {
    this.normalizeCommands( commands )

    this.translation = Object.assign( translation, this.translation )
    this.commands = Object.assign( commands, this.commands )
    this.filters = Object.assign( filters, this.filters )
  }

  /**
   * @param {GuildModuleCommands} commands
   */
  normalizeCommands( commands ) {
    const checkField = (field, property, surrogate, defaultVal) => {
      if (surrogate in field) {
        field[ property ] = field[ surrogate ]

        delete field[ surrogate ]
      } else if (!(property in field)) {
        field[ property ] = defaultVal
      }
    }

    for (const property in commands) {
      const field = commands[ property ]

      checkField( field, `roles`, `r`, [] )
      checkField( field, `desc`,  `d`, `` )
      checkField( field, `value`, `v` )

      if (typeof field.value === `function`) checkField( field, `masks`, `m`, [] )
      else this.normalizeCommands( field.value )
    }
  }
}

class CommandProcessor {
  /** @type {string[]} */
  #parameters = []

  /** @type {GuildModuleCommands} */
  #commandsStructure = {}
  /** @type {GuildModuleCommands|GuildModuleCommandsField} */
  #scopeFromCommand = {}

  #command = ``
  #prefix = ``
  #parts = { prev:``, part:``, rest:`` }
  #path = ''

  /**
   * @typedef {Object} CommandError
   * @property {string|null} type
   * @property {*} value
   * @property {RegExp|null} paramMask
  */
 /** @type {CommandError} */
  #err = { type:null, value:null, paramMask:null }

  /**
   * @param {string} prefix
   * @param {string} message
   * @param {GuildModuleCommands>} commandsStructure
   */
  constructor( prefix, message, commandsStructure ) {
    this.#commandsStructure = commandsStructure

    this.#command = message.trim()
    this.#parts = this.partCommand()
    this.#prefix = prefix

    this.#parts.rest = message.slice( prefix.length ).trim()
  }

  get commandsStructure() {
    return this.#commandsStructure
  }
  get parameters() {
    return this.#parameters
  }
  get command() {
    return this.#command
  }
  get prefix() {
    return this.#prefix
  }
  get parts() {
    return { ...this.#parts }
  }
  get path() {
    return this.#path
  }
  get err() {
    return { ...this.#err }
  }

  /**
   * @param {string} [type]
   * @param {*} [value]
   * @param {RegExp} [value]
   */
  setError( type=null, value=null, paramMask=null ) {
    this.#err.type = type
    this.#err.value = value
    this.#err.paramMask = paramMask
  }

  nextPart() {
    this.#parts = this.partCommand( this.#parts.rest )

    return !!this.#parts.part
  }

  partCommand( command='' ) {
    const { groups } = /^(?<part>\S+)(?: +(?<rest>[\s\S]*))?/.exec( command ) || { groups:{} }

    /** @type {string} */
    const prev = this.#parts ? `${this.#parts.prev} ${this.#parts.part}` : ``
    /** @type {string} */
    const part = groups.part || ''
    /** @type {string} */
    const rest = groups.rest || ''

    return { prev, part, rest }
  }

  checkPrefix( prefixSpace=true ) {
    const { command, prefix } = this
    const firstWord = command.split( ` ` )[ 0 ]

    if (!command.startsWith( prefix )) this.setError( 'noPrefix' )

    if (prefixSpace) {
      if (firstWord !== prefix) return this.setError( 'noPrefix' )
    } else {
      if (firstWord !== command) return this.setError( 'noPrefix' )
    }
  }

  /**
   * @param {function} roleTesterFunction
   */
  checkAccessToStructure( roleTesterFunction ) {
    this.#scopeFromCommand = this.#commandsStructure

    if (!this.err.type) while (this.nextPart()) {
      const { err, parts:{ part } } = this

      if (err.type) return

      if (!(part in this.#scopeFromCommand)) {
        return this.setError( 'noCommand', this.command )
      }

      const structPart = this.#scopeFromCommand[ part ]

      if (!roleTesterFunction( structPart.roles )) {
        return this.setError( 'badRole' )
      }

      if (typeof structPart.value === `function`) {
        this.#scopeFromCommand = structPart

        return
      } else {
        this.#scopeFromCommand = structPart.value
      }
    }
  }

  validateParams() {
    if (this.err.type || typeof this.#scopeFromCommand.value != `function`) return

    const { masks } = this.#scopeFromCommand
    const paramAdder = paramString => {
      if (!paramString) return

      const isParamValueNumber = /\d+(?:[\d_]*\d)?(?:\.\d+(?:[\d_]*\d)?)?(?:e\d+(?:[\d_]*\d)?)?/.test( paramString )

      console.log( `"${paramString}"` )

      this.#parameters.push( isParamValueNumber
        ? Number( paramString.replace( /_/g, `` ) )
        : paramString
      )
    }

    let params = this.#parts.rest

    for (const mask of masks) {
      if (!mask.test( params )) {
        if (!params) {
          const commandFunc = this.#scopeFromCommand.value
          const paramNames = CommandProcessor.funcData( commandFunc )

          this.setError( `noParam`, paramNames[ masks.indexOf( mask ) ], mask )
        } else {
          this.setError( `badParam`, params.split( ` ` )[ 0 ]  ||  ` 👈`, mask )
        }

        return
      }

      const paramValue = mask.exec( params )[ 0 ] || null

      if (paramValue){
        params = params.substr( paramValue.length ).trimLeft()

        paramAdder( paramValue )
      }
    }

    params.split( ` ` ).forEach( paramAdder )
  }

  execute() {
    if (this.err.type || typeof this.#scopeFromCommand.value != `function`) return

    this.#scopeFromCommand.value( ...this.#parameters )
  }

  /**
   * @param {boolean} prefixSpace
   * @param {function} roleTesterFunction
   */
  process( prefixSpace, roleTesterFunction ) {
    const { err } = this

    this.checkPrefix( prefixSpace )
    this.checkAccessToStructure( roleTesterFunction )
    this.validateParams()
    this.execute()
  }

  /**
   * @param {function} func
   */
  static funcData( func ) {
    const reg = {
      funcParter: /^(?<name>\S+) *\( *(?<params>[\s\S]*?) *\) *{ *(?<code>[\s\S]*)}$/,
      params: /\w+ *(?:= *.+?)?(?=, *|$)/g
    }

    const { params } = reg.funcParter.exec( func.toString() ).groups
    const paramNames = params.match( reg.params ) || []

    return paramNames
  }
}

export default class CactuDiscordBot {
  discordClient = new Discord.Client()
  botOperatorRole = ``
  /** @type {Object<string,string>} */
  publicVars = {}

  /** @type {Map<string,GuildModules>} */
  guildsData = new Map()

  moduleLogger = new Logger( [
    { align:'right',  color:'fgMagenta', length:30 }, // /(Filter|Command)/
    { align:'center', color:'bright',    length:6 },  // /(Filter|Command)/
    { align:'right',  color:'fgBlue',    length:10 }, // /(Filter|Command)/
    { length:3 },                                     // /:  /
    { align:'right',  color:'fgYellow',  length:15 }, // /displayName/
    { length:3 },                                     // /:  /
    { splitLen:200, splitFLLen:150 },                 // /.*/
  ] )
  botLogger = new Logger( [
    { align:'right', color:'fgMagenta', length:5 },  // /Bot/
    { length:3 },                                    // /:  /
    { splitLen:90, splitFLLen:65 },                  // /.*/
  ] )

  prefix = `cc!`
  prefixSpace = true
  signs = {}

  /**
   * @typedef {Object} CactuDiscordBotConfig
   * @property {string} token
   * @property {string} [prefix]
   * @property {boolean} [prefixSpace]
   * @property {Object<string,*>} [publicVars]
   * @property {{ok:string,warn:string,error:string}} [signs]
   */
  /**
   * @param {CactuDiscordBotConfig} config
   */
  constructor( config ) {
    if ('prefix'      in config) this.prefix      = config.prefix
    if ('prefixSpace' in config) this.prefixSpace = config.prefixSpace
    if ('publicVars'  in config) this.publicVars  = config.publicVars
    if ('signs'       in config) this.signs       = config.signs

    const guilds = this.guildsData

    fs.readdirSync( `./guilds_modules` ).forEach( fileName => {
      const id = fileName.match( /(.*?)-(.*)/ )[ 1 ]

      if (!guilds.has( id )) guilds.set( id, new GuildModules() )

      import( `./guilds_modules/${fileName}` )
        .then( module => typeof module.default === `function`
          ? module.default( { ...this.publicVars } )
          : module.default
        )
        .then( moduleObject => guilds.get( id ).include( moduleObject ) )
        .catch( console.log )
    } )

    this.discordClient
      .on( 'message', this.onMessage )
      .on( 'ready', this.onReady )
      .login( config.token || `` )
      .catch( () => this.log( `I can't login in` ) )
  }

  /**
   * @param {string} string
   */
  log( string ) {
    this.botLogger( 'Bot', ':', string )
  }

  /**
   * @param {string[]} roleNames
   */
  checkPermissions( roleNames ) {
    return true
  }

  /** New message event handler
   * @param {Discord.Message} message
   */
  onMessage = message => {
    const { prefix, prefixSpace } = this
    const { commands } = this.guildsData.get( message.guild.id )
    const commandProcessor = new CommandProcessor( prefix, message.content, commands )

    commandProcessor.process( prefixSpace, this.checkPermissions )

    console.log( commandProcessor.err )
  }

  onReady = () => {
    console.log()
    this.log( 'I have been started' )
    console.log()

    this.discordClient.user.setActivity( this.prefix, { type:'WATCHING' } )
  }
}