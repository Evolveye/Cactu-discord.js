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
    this.translation = Object.assign( translation, this.translation )
    this.commands = Object.assign( commands, this.commands )
    this.filters = Object.assign( filters, this.filters )
  }
}

class CommandData {
  #response = { code:[], params:[], values:[] }
  #command = ``
  #parts = { prev:``, part:``, rest:`` }
  #path = ''
  #err = { type:null, value:null, paramMask:null }
  /**
   * @param {Discord.Message} message
   */
  constructor( message, prefix ) {
    const { content } = message

    this.#command = content.trim()
    this.#parts = this.partCommand( this.#command.slice( prefix.length ).trim() )
  }

  get command() { return this.#command }
  get parts() { return { ...this.#parts } }
  get path() { return this.#path }
  get err() { return { ...this.#err } }

  /**
   * @param {any} err
   * @param {string} type
   * @param {string} value
   */
  setError( type, value ) {
    this.#err.type = type
    this.#err.value = value
  }

  nextPart() {
    this.#parts = this.partCommand( this.#parts.rest )

    return !!this.#parts.part
  }

  partCommand( command ) {
    const { groups } = /^(?<part>\S+)(?: +(?<rest>[\s\S]*))?/.exec( command ) || { groups:{} }

    /** @type {string} */
    const prev = this.#parts ? this.#parts.prev + this.#parts.part : ``
    /** @type {string} */
    const part = groups.part || ''
    /** @type {string} */
    const rest = groups.rest || ''

    return { prev, part, rest }
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

  /**
   * @param {CommandData} commandData
   */
  checkPrefix( commandData ) {
    const { prefix, prefixSpace } = this
    const { command, parts } = commandData
    const firstWord = command.split( ` ` )[ 0 ]

    if (!command.startsWith( prefix )) return false

    if (prefixSpace) {
      if (firstWord !== prefix) return false
    } else {
      if (firstWord !== command) return false
    }

    return true
  }

  /**
   * @param {CommandData} commandData
   * @param {function(string[]): boolean} rolesTest
   */
  checkAccesToStructure( commandData, structure ) {
    const { prefix, prefixSpace } = this

    if (commandData.err.type) return

    console.log( commandData.command, commandData.parts )

    while (commandData.nextPart()) {
      const { prev, part, rest } = commandData.parts

      console.log( part )

      if (!(part in structure)) {
        commandData.setError( 'noCommand', commandData.command )
        break
      }

      command = rest || ''
      path += ` ${part}`
      structure = structure[ part ]

      if (structure[ '@code' ]) {
        if (!rolesTest( structure[ '@roles' ] )) commandData.setError( err, 'badRole' )
        break
      } else if (!rolesTest( structure[ '@roles' ] )) {
        commandData.setError( err, 'badRole' )
        break
      }
    }

    // if (prefixSpace) path = `${prefix}${path}`
    // else path = `${prefix}${path.slice( 1 )}`

    // commandData.command = command
    // commandData.path = path
    // commandData.parts = parts
    // commandData.structure = structure
  }

  /** New message event handler
   * @param {Discord.Message} message
   */
  onMessage = message => {
    const { commands } = this.guildsData.get( message.guild.id )
    const commandData = new CommandData( message, this.prefix )
    const { err } = commandData

    if (!this.checkPrefix( commandData )) return

    if (!err.type) this.checkAccesToStructure( commandData, commands )
    // if (!err.type) this.buildResponse( data )

    // if (err.type) this.processErrors( data )

    console.log( commandData.parts )
  }

  onReady = () => {
    console.log()
    this.log( 'I have been started' )
    console.log()

    this.discordClient.user.setActivity( this.prefix, { type:'WATCHING' } )
  }
}