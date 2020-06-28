import Discord from 'discord.js'
import fs from 'fs'

import Filters from './Filters.js'
import Commands from './Chat.js'
import Logger from "./Logger.js"

if (!fs.existsSync( `./guilds_modules/` )) fs.mkdirSync( `./guilds_modules/` )

export const LoggerClass = Logger

class GuildModule {
  /**
   * @property {object} translation
   * @property {object} filters
   * @property {object} commands
   */
  constructor( translation={}, filters={}, commands={} ) {
    this.translation = translation
    this.filters = filters
    this.command = commands
  }

  include( { translation, filters, commands } ) {
    this.normalizeCommands( commands )

    this.translation = Object.assign( translation, this.translation )
    this.commands = Object.assign( commands, this.commands )
    this.filters = Object.assign( filters, this.filters )
  }

  normalizeCommands( commands ) {
    const checkField = (field, property, surrogate) => {
      if (surrogate in field) {
        field[ property ] = field[ surrogate ]

        delete field[ surrogate ]
      }
    }
    for (const property in commands) {
      const field = commands[ property ]

      checkField( field, `roles`, `r` )
      checkField( field, `desc`, `d` )
      checkField( field, `value`, `v` )

      if (typeof field.value === `function`) checkField( field, `masks`, `m` )
      else this.normalizeCommands( field.value )
    }
  }
}

class CommandProcessor {
  #response = { code:[], params:[], values:[] }

  #commandsStructure = {}
  #scopeFromCommand = {}

  #command = ``
  #prefix = ``
  #parts = { prev:``, part:``, rest:`` }
  #path = ''
  #err = { type:null, value:null, paramMask:null }

  /**
   * @param {Discord.Message} message
   */
  constructor( prefix, message, commandsStructure ) {
    const { content } = message

    this.#commandsStructure = commandsStructure

    this.#command = content.trim()
    this.#parts = this.partCommand()
    this.#prefix = prefix

    this.#parts.rest = content.slice( prefix.length ).trim()
  }

  get commandsStructure() {
    return this.#commandsStructure
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
   * @param {any} err
   * @param {string} type
   * @param {string} value
   */
  setError( type=null, value=null ) {
    this.#err.type = type
    this.#err.value = value
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

  checkAccesToStructure( roleTesterFunction ) {
    if (!this.err.type) while (this.nextPart()) {
      const { err, parts:{ part } } = this

      if (err.type) return

      if (!(part in this.#commandsStructure)) {
        return this.setError( 'noCommand', this.command )
      }

      const structPart = this.#commandsStructure[ part ]

      if (!roleTesterFunction( structPart.roles )) {
        return this.setError( 'badRole' )
      }

      if (typeof structPart.value === `funstion`) return

      this.#scopeFromCommand = structPart.value
    }
  }

  process( prefixSpace, roleTesterFunction ) {
    const { err } = this

    this.checkPrefix( prefixSpace )

    if (!err.type) this.checkAccesToStructure( roleTesterFunction )
    // if (!err.type) this.buildResponse( data )

    // if (err.type) this.processErrors( data )
  }
}

export default class CactuDiscordBot {
  discordClient = new Discord.Client()
  botOperatorRole = ``
  loggedErrors = []

  /** @type {Map<string,GuildModule>} */
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
  evalVars = {}
  spamConfig = {}
  signs = {}

  constructor( config ) {
    if ('prefix'      in config) this.prefix      = config.prefix
    if ('prefixSpace' in config) this.prefixSpace = config.prefixSpace
    if ('spamConfig'  in config) this.spamConfig  = config.spamConfig
    if ('evalVars'    in config) this.evalVars    = config.evalVars
    if ('signs'       in config) this.signs       = config.signs

    const guilds = this.guildsData

    fs.readdirSync( `./guilds_modules` ).forEach( fileName => {
      const id = fileName.match( /(.*?)-(.*)/ )[ 1 ]

      if (!guilds.has( id )) guilds.set( id, new GuildModule() )

      import( `./guilds_modules/${fileName}` )
        .then( module => guilds.get( id ).include( module.default ) )
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

  checkPermissions( roleNames ) {
    return true
  }

  /** New message event handler
   * @param {Discord.Message} message
   */
  onMessage = message => {
    const { prefix, prefixSpace } = this
    const { commands } = this.guildsData.get( message.guild.id )
    const commandProcessor = new CommandProcessor( prefix, message, commands )

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