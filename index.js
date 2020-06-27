import Discord from 'discord.js'
import fs from 'fs'

import Filters from './Filters.js'
import Commands from './Chat.js'
import Logger from "./Logger.js"

if (!fs.existsSync( `./guilds_modules/` )) fs.mkdirSync( `./guilds_modules/` )

export const LoggerClass = Logger

/**
 * @typedef {object} GuildModule
 * @property {object} translation
 * @property {object} filters
 * @property {object} commands
 */

class CommandData {
  /**
   * @param {Discord.Message} message
   */
  constructor( message ) {
    const { content } = message

    this.command = content.trim()
    this.path = ''
    this.parts = CommandData.partCommand( content )
    this.response = { code:[], params:[], values:[] }
    this.err = { type:null, value:null, paramMask:null }
  }

  /**
   * @param {any} err
   * @param {string} type
   * @param {string} value
   */
  setError( err, type, value ) {
    err.type = type
    err.value = value
  }

  /**
   * @param {string} command
   */
  static partCommand( command ) {
    const { groups } = /^(?<part>\S+)(?: +(?<rest>[\s\S]*))?/.exec( command ) || { groups:{} }

    if (!groups.part) groups.part = ''
    if (!groups.rest) groups.rest = ''

    return groups
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
    if (  'prefix'      in config) this.prefix      = config.prefix
    if (  'prefixSpace' in config) this.prefixSpace = config.prefixSpace
    if (  'spamConfig'  in config) this.spamConfig  = config.spamConfig
    if (  'evalVars'    in config) this.evalVars    = config.evalVars
    if (  'signs'       in config) this.signs       = config.signs

    const guilds = this.guildsData

    fs.readdirSync( `./guilds_modules` ).forEach( fileName => {
      const id = fileName.match( /(.*?)-(.*)/ )[ 1 ]

      if (!guilds.has( id )) guilds.set( id, [] )

      import( `./guilds_modules/${fileName}` )
        .then( module => guilds.get( id ).push( module.default ) )
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

    if (!command.startsWith( prefix )) return false

    if (prefixSpace) {
      if (prefix !== parts.part) return false
    } else {
      if (parts.part === prefix && parts.rest !== '') return false
    }

    if (prefixSpace) commandData.command = parts.rest
    else commandData.command = command.slice( prefix.length )

    return true
  }

  /**
   * @param {CommandData} commandData
   * @param {function(string[]): boolean} rolesTest
   */
  checkAccesToStructure( commandData, structure ) {
    const { prefix, prefixSpace } = this
    let { command, path, parts, err } = commandData

    if (err.type) return

    while ((parts = this.partCommand( command )).part !== '') {
      if (!command) break

      const { part, rest } = parts

      if (!(part in structure)) {
        this.setError( err, 'noCommand', part )
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

    if (prefixSpace) path = `${prefix}${path}`
    else path = `${prefix}${path.slice( 1 )}`

    commandData.command = command
    commandData.path = path
    commandData.parts = parts
    commandData.structure = structure
  }

  /** New message event handler
   * @param {Discord.Message} message
   */
  onMessage = message => {
    const guildData = this.guildsData.get( message.guild.id )
    const commandData = new CommandData( message )

    if (!this.checkPrefix( commandData )) return

    // if (!err.type) this.checkAccesToStructure( commandData, structure )
    // if (!err.type) this.buildResponse( data )

    // if (err.type) this.processErrors( data )

    // console.log( guildData )
  }

  onReady = () => {
    console.log()
    this.log( 'I have been started' )
    console.log()

    this.discordClient.user.setActivity( this.prefix, { type:'WATCHING' } )
  }
}