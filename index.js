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
/** @typedef {import("./GuildModules.js").UnsafeVariables} GuildModule */


export default class CactuDiscordBot {
  discordClient = new Discord.Client()

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
  signs = { error:'❌', warn:'⚠️', ok:'✅' }

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
   * @param {Discord.Message} param2
   */
  handleError({ type, value, paramMask }, translation, message) {
    const { error } = this.signs
    let title = `Unknown error`
    let description = ``

    switch (type) {
      case `invalidCmd`:
        title = `${error} ${translation.err_invalidCmd}`
        description = `> \`${value.message}\` ::  ` + value.stack.split( `\n` )[ 1 ]
          .split( /-/ )
          .slice( -1 )[ 0 ]
          .slice( 0, -1 )
        break

      case `badParam`:
        title = `${error} ${translation.err_badParam}`
        description = `> ${value}`
        break

      case `noCommand`: {
        const fields = []
        const scopes = []
        const cmds = []

        for (const part in value) {
          const { type, desc, params } = value[ part ]

          if (type == `scope`) {
            scopes.push( { name:part, value:desc, inline:true } )
          } else {
            cmds.push( { name:part, value:desc } )
          }
        }

        if (scopes.length) fields.push( ...scopes, { name:`\u200B`, desc:`\u200B` } )

        fields.push( ...cmds )

        title = `⚙️ ${translation.help_title}`
      }; break

      case `noParam`:
        title = `${error} ${translation.err_noParam}`
        description = `> ${value} \`${paramMask}\``
        break

      case `noPath`:
        title = `${error} ${translation.err_noPath}`
        description = `> ${value}`
        break

      case `noPerms`:
        title = `${error} ${translation.err_noPerms}`
        description = `> ${value}`
        break

      case `noPrefix`:
        return
    }

    console.log( { title, description, type } )
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
    const guildData = this.guildsData.get( id )
    const { commands, translation, botOperatorId } = guildData
    const commandProcessor = new CommandProcessor( !guild, prefix, content, commands )

    guildData.setVariables( message, this )

    commandProcessor.process(
      prefixSpace,
      roles => this.checkPermissions( roles, botOperatorId, message ),
      err => this.handleError( err, translation, message ),
    )
  }

  onReady = () => {
    console.log()
    this.log( `I have been started` )
    console.log()

    this.discordClient.user.setActivity( this.prefix, { type:`WATCHING` } )
  }
}