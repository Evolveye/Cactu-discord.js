import Discord from 'discord.js'
import fs from 'fs'

import CommandProcessor from './CommandProcessor.js'
import GuildModules from './GuildModules.js'
import Logger from "./Logger.js"

if (!fs.existsSync( `./guilds_modules/` )) fs.mkdirSync( `./guilds_modules/` )

export const LoggerClass = Logger

/** @typedef {import("./CommandProcessor.js").CommandErrorType} CommandErrorType */
/** @typedef {import("./CommandProcessor.js").CommandError} CommandError */

/** @typedef {import("./GuildModules.js").GuildModuleTranslation} GuildModuleTranslation */
/** @typedef {import("./GuildModules.js").GuildModuleFilters} GuildModuleFilters */
/** @typedef {import("./GuildModules.js").GuildModuleRoles} GuildModuleRoles */
/** @typedef {import("./GuildModules.js").GuildModuleCommandsField} GuildModuleCommandsField */
/** @typedef {import("./GuildModules.js").GuildModuleCommands} GuildModuleCommands */
/** @typedef {import("./GuildModules.js").GuildModule} GuildModule */

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