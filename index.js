import Discord from "discord.js"
import fs from "fs"

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

    if ( !fs.existsSync( `./guilds_config/` ) )
      fs.mkdirSync( `./guilds_config/` )

    const { prefix, prefixSpace, spamConfig, evalVars, token } = config

    this.spamConfig = spamConfig
    this.botOperatorId = null

    this.client = new Discord.Client
    this.guildsDbs = new Map
    this.log = new Logger( [
      { align:`right`, color:`fgGreen`,  length:10 }, // /(Filter|Command)/
      { length:3 },  // /:  /
      { align:`right`, color:`fgBlue`,  length:15 }, // /displayName/
      { length:3 },  // /:  /
      { splitLen:90, splitFLLen:65 }  // /.*/
    ] )

    this.evalVars = evalVars
    this.evalVars.message = null
    this.evalVars.db = null
    this.evalVars.bot = this

    let c = this.client

    c
    .on( `message`, message => {
      if ( !message.guild )
        return

      const guildDb = this.guildsDbs.get( message.guild.id )

      if ( `roleId` in spamConfig )
        this.testSpam( message, guildDb )
      if ( message.author.bot )
        return

      this.evalVars.message = message
      this.evalVars.db = guildDb.db

      guildDb.filters.catch( message.content, this.evalVars )
      guildDb.commands.convert( message.content, this.evalVars, roles => {
        if ( message.channel.type === `dm` )
          return false

        if ( message.author.id === message.guild.ownerID || message.member.roles.has( this.botOperatorId ) )
          return true

        for ( const role of roles ) {
          const roleObject = message.guild.roles.find( "name", role )
          const havingARole = roleObject  ?  message.member.roles.has( roleObject.id )  :  false

          if ( havingARole )
            return true
        }
      } )
    } )
    .on( `ready`, () => {
      console.log( `Bot has been started` )

      for ( const [ id, guild ] of c.guilds ) {
        this.guildsDbs.set( id, new GuildDb( this.log, id, prefix, prefixSpace ) )
        guild.fetchInvites().then( invites => this.guildsDbs.get( id ).invites = invites )
      }

      c.user.setActivity( prefix, { type:'WATCHING' } )
    } )
    .on( `guildCreate`, guild => {
      this.guildsDbs.set( guild.id, new GuildDb( this.log, guild.id, prefix, prefixSpace ) )

      guild.fetchInvites().then( invites => this.guildsDbs.get( guild.id ).invites = invites )
    } )
    // .on( `guildMemberAdd`, member => {
    //   const guild = member.guild
    //   const guildDb = guildsDbs.get( guild.id )

    //   guild.fetchInvites().then( invites => {
    //     const invite = invites.find( i =>  guildDb.invites.get( i.code ).uses < i.uses )

    //     console.log( member.displayName, invite.code )

    //     guild.invites.set( guildId, invites )
    //   } )
    // } )
    .login( token )
  }

  validateConfig( config ) {
    if ( !("prefix" in config) )
      config.prefix = `cc!`
    if ( !("prefixSpace" in config) )
      config.prefixSpace = true
    if ( !("spamConfig" in config) )
      config.spamConfig = {}
    if ( !("evalVars" in config) )
      config.evalVars = {}
  }

  testSpam( message, guildDb ) {
    const s = this.spamConfig

    if ( !guildDb.users.has( message.author.id ) ) {
      guildDb.users.set( message.author.id, {
        lastMessageTime: 0,
        spamPoints: 0
      } )
    }

    let user = guildDb.users.get( message.author.id )

    if ( Date.now() - user.lastMessageTime < (s.interval || 2000) ) {
      if ( ++user.spamPoints >= (s.points || 10) ) {
        // if ( c.user.id != message.author.id )
        message.member.addRole( message.guild.roles.get( s.roleId ) )

        user.spamPoints = 0
      }
    }
    else {
      let pointsToRemove = Math.floor( (Date.now() - user.lastMessageTime) / 4000 )
      user.spamPoints -= user.spamPoints - pointsToRemove < 0  ?  user.spamPoints  :  pointsToRemove
    }

    user.lastMessageTime = Date.now()
  }

  evalCmd( message, command ) {
    const guildDb = this.guildsDbs.get( message.guild.id )
    const cmds = guildDb.commands
    const vars = this.evalVars

    vars.db = guildDb.db
    vars.message = message

    cmds.convert( `${cmds.prefix}${cmds.prefixSpace  ?  ` `  :  ``}${command}`, vars )
  }
}