import Discord from 'discord.js'
import fs from 'fs'

import Filters from './Filters.js'
import Commands from './Chat.js'
import Logger from "./Logger.js"

if (!fs.existsSync( `./guilds_modules/` )) fs.mkdirSync( `./guilds_modules/` )

export const LoggerClass = Logger

/** @typedef {Object<string,string>} GuildModuleTranslation */
/** @typedef {Object<string,function>} GuildModuleFilters */
/** @typedef {("@nobody"|"@dm"|"@owner"|"@bot"|"@everyone")[]|string[]} GuildModuleRoles */
/** @typedef {Object} GuildModuleCommandsField
 * @property {GuildModuleRoles} roles
 * @property {string} desc
 * @property {RegExp[]} masks
 * @property {function|GuildModuleCommands} value
 */
/** @typedef {Object<string,GuildModuleCommandsField} GuildModuleCommands */
/** @typedef {Object} GuildModule
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
  constructor( translation={}, filters={}, commands={}, botOperatorId=`` ) {
    this.translation = translation
    this.filters = filters
    this.command = commands
    this.botOperatorId = botOperatorId
  }

  /**
   * @param {GuildModule} param0
   */
  include( { translation={}, filters={}, commands={}, botOperatorId=`` } ) {
    this.normalizeCommands( commands )

    this.translation = Object.assign( translation, this.translation )
    this.commands = Object.assign( commands, this.commands )
    this.filters = Object.assign( filters, this.filters )
    this.botOperatorId = botOperatorId
  }

  /**
   * @param {GuildModuleCommands} commands
   */
  normalizeCommands( commands ) {
    const checkField = (field, property, surrogate, defaultVal) => {
      if (surrogate in field) {
        let value = field[ surrogate ]

        if (Array.isArray( defaultVal ) && !Array.isArray( value )) {
          value = [ `${value}` ]
        }

        field[ property ] = value

        delete field[ surrogate ]
      } else if (!(property in field)) {
        field[ property ] = defaultVal
      }
    }

    for (const property in commands) {
      const field = commands[ property ]

      checkField( field, `roles`, `r`, [ `@everyone` ] )
      checkField( field, `desc`,  `d`, `` )
      checkField( field, `value`, `v` )

      if (typeof field.value === `function`) checkField( field, `masks`, `m`, [] )
      else this.normalizeCommands( field.value )
    }
  }
}

/** @typedef {"badParam"|"noCommand"|"noParam"|"noPerms"|"noPrefix"} CommandErrorType */
/** @typedef {Object} CommandError
 * @property {CommandErrorType} type
 * @property {*} value
 * @property {RegExp|null} paramMask
*/

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
  #isDm = false

  /** @type {CommandError} */
  #err = { type:null, value:null, paramMask:null }

  /**
   * @param {string} prefix
   * @param {string} message
   * @param {GuildModuleCommands>} commandsStructure
   */
  constructor( isDm, prefix, message, commandsStructure ) {
    this.#commandsStructure = commandsStructure

    this.#command = message.trim()
    this.#parts = this.partCommand()
    this.#prefix = prefix
    this.#isDm = isDm

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
   * @param {CommandErrorType} [type]
   * @param {*} [value]
   * @param {RegExp} [paramMask]
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

    if (!command.startsWith( prefix )) this.setError( `noPrefix` )

    if (prefixSpace) {
      if (firstWord !== prefix) return this.setError( `noPrefix` )
    } else {
      if (firstWord !== command) return this.setError( `noPrefix` )
    }
  }

  /**
   * @param {function} roleTesterFunction
   */
  checkAccessToStructure( roleTesterFunction ) {
    this.#scopeFromCommand = this.#commandsStructure
    /** @param {GuildModuleRoles} roles */
    const checkAccess = roles => {
      if (roles.includes( `@nobody` )) return false
      if (this.#isDm) return roles.includes( `@dm` )
      if (roles.includes( `@everyone` )) return true

      return roleTesterFunction( roles )
    }

    if (!this.err.type) while (this.nextPart()) {
      const { err, parts:{ part } } = this

      if (err.type) return

      if (!(part in this.#scopeFromCommand)) {
        return this.setError( `noCommand`, this.command )
      }

      const structPart = this.#scopeFromCommand[ part ]

      if (!checkAccess( structPart.roles )) {
        return this.setError( `noPerms` )
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
   * @param {function} [errorHandlerFunction]
   */
  process( prefixSpace, roleTesterFunction, errorHandlerFunction=null ) {
    this.checkPrefix( prefixSpace )
    this.checkAccessToStructure( roleTesterFunction )
    this.validateParams()
    this.execute()

    if (this.#err.type && errorHandlerFunction) errorHandlerFunction( this.err )
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
   * @param {GuildModuleRoles} roleNames
   * @param {Discord.Snowflake} botOperatorId
   * @param {Discord.Message} param2
   */
  checkPermissions( roleNames, botOperatorId, { author, member, guild } ) {
    if (author.bot) return roleNames.includes( `@bot` )
    if (author.id === guild.ownerID || member.roles.has( botOperatorId )) return true

    for (const roleName of roleNames) {
      const roleObject = guild.roles.find( r => r.name === roleName )
      const havingARole = roleObject ? member.roles.has( roleObject.id ) : false

      if (havingARole) return true
    }
  }

  /**
   * @param {CommandError} param0
   * @param {GuildModuleTranslation} translation
   * @param {Discord.Message} message
   */
  handleError({ type, value, paramMask }, translation, message) {
    let title = `Unknown error`
    let description = ``

    switch (type) {
      case `badParam`:
        title = `You passed wrong parameter!`
        break
      case `noCommand`:
        title = `That command doesn't exists!`
        break
      case `noParam`:
        title = `That command require parameter!`
        break
      case `noPerms`:
        title = `You don't have required permissions!`
        break
      case `noPrefix`:
        break
    }

    console.log( { title, description, value })
  }

  /**
   * @param {Discord.Message} message
   */
  onMessage = message => {
    const { guild, author, content } = message

    const id = guild
      ? guild.id
      : author
      ? author.client.guilds.find( ({ id }) => this.discordClient.guilds.has( id ) ).id
      : null

    if (!id) return

    const { prefix, prefixSpace } = this
    const { commands, translation, botOperatorId } = this.guildsData.get( id )
    const commandProcessor = new CommandProcessor( !guild, prefix, content, commands )

    commandProcessor.process(
      prefixSpace,
      roles => this.checkPermissions( roles, botOperatorId, message ),
      err => this.handleError( err, translation, message )
    )

    // console.log( commands )
  }

  onReady = () => {
    console.log()
    this.log( `I have been started` )
    console.log()

    this.discordClient.user.setActivity( this.prefix, { type:`WATCHING` } )
  }
}