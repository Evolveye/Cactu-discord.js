import Discord from 'discord.js'
import fs from 'fs'

import Filters from './Filters.js'
import Commands from './Commands.js'
import Logger from "./Logger.js"

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
  constructor( config ) {
    this.validateConfig( config )

    const { prefix, prefixSpace, spamConfig, evalVars, token, signs } = config

    this.prefix = prefix
    this.prefixSpace = prefixSpace
    this.evalVars = evalVars
    this.spamConfig = spamConfig
    this.signs = signs
    this.botOperatorId = null
    this.client = new Discord.Client

    /** @type {Map<string,GuildData>} */
    this.guildsData = new Map

    // Command:  Evolveye: cc! log message
    this.messageDataLogger = new Logger( [
      { align:'right', color:'fgBlue',   length:10 },  // /(Filter|Command)/
      { length:3 },                                    // /:  /
      { align:'right', color:'fgYellow', length:15 },  // /displayName/
      { length:3 },                                    // /:  /
      { splitLen:90, splitFLLen:65 },                  // /.*/
    ] )

    // Bot:  message
    this.logger = new Logger( [
      { align:'right', color:'fgMagenta', length:5 },  // /Bot/
      { length:3 },                                    // /:  /
      { splitLen:90, splitFLLen:65 },                  // /.*/
    ] )

    if (!fs.existsSync( './guilds_config/' )) fs.mkdirSync( './guilds_config/' )

    this.client
      .on( 'message', message => this.onMessage( message ) )
      .on( 'ready', () => this.onReady() )
      .on( 'guildCreate', guild => onCreateGuild( guild ) )
      .on( `messageReactionAdd`, (reaction, user) => {
        const { guild } = reaction.message

        if (!guild) return

        const { messageReactionAdd } = this.guildsData.get( guild.id ).commands.events

        if (messageReactionAdd) messageReactionAdd( reaction, user )
      } )
      .on( 'guildMemberAdd', member => {
        const { guild } = member

        if (!guild) return

        const guildData = this.guildsData.get( guild.id )
        const { guildMemberAdd } = guildData.commands.events

        guild.fetchInvites().then( invites => {
          if (guildMemberAdd) try {
            guildMemberAdd( member, invites.find( i => guildData.invites.get( i.code ).uses < i.uses ) )
          } catch {
            this.logger( 'Bot', ':', `onGuildMemberAdd command error` )
          }
        } )
      } )
      .login( token )
  }

  validateConfig( config ) {
    if (!('prefix' in config)) config.prefix = 'cc!'
    if (!('prefixSpace' in config)) config.prefixSpace = true
    if (!('spamConfig' in config)) config.spamConfig = {}
    if (!('evalVars' in config)) config.evalVars = {}
    if (!('signs' in config)) config.signs = {}

    config.signs = Object.assign( {}, config.signs, { error:'❌', warn:'⚠️', ok:'✅' } )

    config.evalVars.message = null
    config.evalVars.guildData = null
    config.evalVars.evalCmd = (message, command) => this.evalCmd( message, command )
    config.evalVars.sendStatus = (message, status='ok') => this.sendStatus( message, status )
  }

  testSpam( message, guildData ) {
    const s = this.spamConfig

    if (!guildData.users.has( message.author.id )) guildData.users.set( message.author.id, {
      lastMessageTime: 0,
      spamPoints: 0
    } )

    const user = guildData.users.get( message.author.id )

    if (Date.now() - user.lastMessageTime < (s.interval || 2000)) {
      if (++user.spamPoints >= (s.points || 10)) {
        // if ( c.user.id != message.author.id )
        message.member.addRole( message.guild.roles.get( s.roleId ) )

        user.spamPoints = 0
      }
    }
    else {
      let pointsToRemove = Math.floor( (Date.now() - user.lastMessageTime) / 4000 )
      user.spamPoints -= user.spamPoints - pointsToRemove < 0 ? user.spamPoints : pointsToRemove
    }

    user.lastMessageTime = Date.now()
  }

  /** Send message with sign on start
   * @param {string} status guild command without prefix
   */
  evalCmd( command ) {
    const message = this.evalVars.message
    const cmds = this.guildsData.get( message.guild.id ).commands

    cmds.execute( `${cmds.prefix}${cmds.prefixSpace ? ' ' : ''}${command}`, this.evalVars )
  }

  /** Send message with sign on start
   * @param {Discord.Message} message
   * @param {"error"|"warn"|"ok"} status
   */
  sendStatus( message, status='ok' ) {
    const sign = status in this.signs ? this.signs[ status ] : `ok`

    this.evalVars.message.channel.send( `${sign}  ${message}` )
  }

  log( string ) {
    this.logger( 'Bot', ':', string )
  }

  /* *
   * Events below */

  /** New message event handler
   * @param {Discord.Message} message
   */
  onMessage( message ) {
    const { guild, content, author, member, channel } = message

    if (!guild) return

    const guildData = this.guildsData.get( guild.id )

    if ('roleId' in this.spamConfig) this.testSpam( message, guildData )
    if (author.bot) return

    this.evalVars.message = message
    this.evalVars.guildData = guildData
    this.evalVars.vars = guildData.userScope

    guildData.filters.catch( content, this.evalVars )
    guildData.commands.execute( content, this.evalVars, roles => {
      if (channel.type === 'dm') return false
      if (author.id === guild.ownerID || member.roles.has( this.botOperatorId )) return true

      for (const role of roles) {
        const roleObject = guild.roles.find( r => r.name === role )
        const havingARole = roleObject ? member.roles.has( roleObject.id ) : false

        if (havingARole) return true
      }
    } )
  }

  onReady() {
    console.log()
    this.log( 'I have been started' )
    console.log()

    this.client.guilds.forEach( guild => this.onCreateGuild( guild ) )
    this.client.user.setActivity( this.prefix, { type:'WATCHING' } )
  }

  onCreateGuild( guild ) {
    this.guildsData.set( guild.id, new GuildData( this.messageDataLogger, guild.id, this.prefix, this.prefixSpace ) )

    guild.fetchInvites().then( invites => this.guildsData.get( guild.id ).invites = invites )
  }
}