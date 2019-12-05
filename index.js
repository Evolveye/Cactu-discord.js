import Discord from 'discord.js'
import fs from 'fs'

import Filters from './Filters.js'
import Commands from './Commands.js'
import Logger from "./Logger.js"

class GuildDb {
  constructor( logger, id, prefix, prefixSpace ) {
    this.commands = new Commands( logger, id, prefix, prefixSpace )
    this.filters = new Filters( logger, id )
    this.users = new Map
    this.invites = {}
    this.db = {}
  }
}

export default class CactuDiscordBot {
  constructor( config ) {
    this.validateConfig( config )

    const { prefix, prefixSpace, spamConfig, evalVars, token } = config

    this.evalVars = evalVars
    this.spamConfig = spamConfig
    this.botOperatorId = null
    this.client = new Discord.Client
    this.guildsDbs = new Map

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
      .login( token )
      // .on( 'guildMemberAdd', member => {
      //   const guild = member.guild
      //   const guildDb = guildsDbs.get( guild.id )

      //   guild.fetchInvites().then( invites => {
      //     const invite = invites.find( i =>  guildDb.invites.get( i.code ).uses < i.uses )

      //     console.log( member.displayName, invite.code )

      //     guild.invites.set( guildId, invites )
      //   } )
      // } )
  }

  validateConfig( config ) {
    if (!('prefix' in config)) config.prefix = 'cc!'
    if (!('prefixSpace' in config)) config.prefixSpace = true
    if (!('spamConfig' in config)) config.spamConfig = {}
    if (!('evalVars' in config)) config.evalVars = {}

    config.evalVars.message = null
    config.evalVars.db = null
    config.evalVars.bot = this
  }

  testSpam( message, guildDb ) {
    const s = this.spamConfig

    if (!guildDb.users.has( message.author.id )) guildDb.users.set( message.author.id, {
      lastMessageTime: 0,
      spamPoints: 0
    } )

    const user = guildDb.users.get( message.author.id )

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

  evalCmd( message, command ) {
    const guildDb = this.guildsDbs.get( message.guild.id )
    const cmds = guildDb.commands
    const vars = this.evalVars

    vars.db = guildDb.db
    vars.message = message

    cmds.convert( `${cmds.prefix}${cmds.prefixSpace ?  ' ' : ''}${command}`, vars )
  }

  log( string ) {
    this.logger( 'Bot', ':', string )
  }

  /* *
   * Events below */

  onMessage( message ) {
    const { guild, content, author, member, channel } = message
    const guildDb = this.guildsDbs.get( guild.id )

    if (!guild) return
    if ('roleId' in spamConfig) this.testSpam( message, guildDb )
    if (author.bot) return

    this.evalVars.message = message
    this.evalVars.db = guildDb.db

    guildDb.filters.catch( content, this.evalVars )
    guildDb.commands.convert( content, this.evalVars, roles => {
      if (channel.type === 'dm') return false
      if (author.id === guild.ownerID || member.roles.has( this.botOperatorId )) return true

      for (const role of roles) {
        const roleObject = guild.roles.find( 'name', role )
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
    this.client.user.setActivity( prefix, { type:'WATCHING' } )
  }

  onCreateGuild( guild ) {
    this.guildsDbs.set( guild.id, new GuildDb( this.messageDataLogger, guild.id, prefix, prefixSpace ) )

    guild.fetchInvites().then( invites => this.guildsDbs.get( guild.id ).invites = invites )
  }
}