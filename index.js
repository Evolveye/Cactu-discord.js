import Discord from 'discord.js'
import fs from 'fs'

import Filters from './Filters.js'
import Commands from './Commands.js'
import Logger from "./Logger.js"

if (!fs.existsSync( `./guilds_modules/` )) fs.mkdirSync( `./guilds_modules/` )

export const LoggerClass = Logger
export class GuildData {
  constructor( logger, id, prefix, prefixSpace ) {
    this.commands = new Commands( logger, id, prefix, prefixSpace )
    this.filters = new Filters( logger, id )
    this.users = new Map
    this.invites = {}
    this.userScope = {}
  }
}

export default class CactuDiscordBot {
  #discordClient = new Discord.Client()
  #botOperatorRole = ``
  #loggedErrors = []

  /** @type {Map<string,GuildData>} */
  #guildsData = new Map()

  #moduleLogger = new Logger( [
    { align:'right',  color:'fgMagenta', length:30 }, // /(Filter|Command)/
    { align:'center', color:'bright',    length:6 },  // /(Filter|Command)/
    { align:'right',  color:'fgBlue',    length:10 }, // /(Filter|Command)/
    { length:3 },                                     // /:  /
    { align:'right',  color:'fgYellow',  length:15 }, // /displayName/
    { length:3 },                                     // /:  /
    { splitLen:200, splitFLLen:150 },                 // /.*/
  ] )
  #botLogger = new Logger( [
    { align:'right', color:'fgMagenta', length:5 },  // /Bot/
    { length:3 },                                    // /:  /
    { splitLen:90, splitFLLen:65 },                  // /.*/
  ] )

  #prefix = `cc`
  #prefixSpace = true
  #evalVars = {}
  #spamConfig = {}
  #signs = {}

  constructor( config ) {
    if (!(  'prefix'      in config)) this.#prefix      = config.prefix
    if (!(  'prefixSpace' in config)) this.#prefixSpace = config.prefixSpace
    if (!(  'spamConfig'  in config)) this.#spamConfig  = config.spamConfig
    if (!(  'evalVars'    in config)) this.#evalVars    = config.evalVars
    if (!(  'signs'       in config)) this.#signs       = config.signs

    this.#discordClient
      .on( 'message', this.onMessage )
      .on( 'ready', this.onReady )
      .login( config.token || `` )
      .catch( () => this.log( `I can't login in` ) )
  }

  /**
   * @param {string} string
   */
  log( string ) {
    this.#botLogger( 'Bot', ':', string )
  }

  /** New message event handler
   * @param {Discord.Message} message
   */
  onMessage = message => {}

  onReady = () => {
    console.log()
    this.log( 'I have been started' )
    console.log()

    this.#discordClient.user.setActivity( this.prefix, { type:'WATCHING' } )
  }
}