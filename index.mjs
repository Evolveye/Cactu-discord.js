import Discord from "discord.js"
import fs from "fs"

import Filters from './Filters.mjs'
import Commands from './Commands.mjs'


export default class CactuDiscordBot {
  constructor( config ) {
    if ( !(`prefix` in config) )
      config.prefix = `cc!`
    if ( !(`prefixSpace` in config) )
      config.spaceAfterPrefix = true
    if ( !(`spam` in config) )
      config.spam = {}
    if ( !(`evalVars` in config) )
      config.evalVars = {}
    if ( !fs.existsSync( `./guilds_config/` ) )
      fs.mkdirSync( `./guilds_config/` )

    this.client = new Discord.Client
    this.guildsDbs = new Map

    this.evalVars = config.evalVars
    this.evalVars.message = null
    this.evalVars.db = null
    this.evalVars.bot = this

    let c = this.client

    c
    .on( `message`, message => {
      const guildDb = this.guildsDbs.get( message.guild.id )

      if ( `roleId` in config.spam ) {
        if ( !guildDb.users.has( message.author.id ) ) {
          guildDb.users.set( message.author.id, {
            lastMessageTime: 0,
            spamPoints: 0
          } )
        }

        let user = guildDb.users.get( message.author.id )

        if ( Date.now() - user.lastMessageTime < config.spam.interval || 2000 ) {
          if ( ++user.spamPoints >= config.spam.points || 10 ) {
            if ( c.user.id != message.author.id )
              message.member.addRole( message.guild.roles.get( config.spam.roleId ) )

            user.spamPoints = 0
          }
        }
        else {
          let pointsToRemove = Math.floor( (Date.now() - user.lastMessageTime) / 4000 )
          user.spamPoints -= user.spamPoints - pointsToRemove < 0  ?  user.spamPoints  :  pointsToRemove
        }

        user.lastMessageTime = Date.now()
      }
      if ( message.author.bot )
        return

      this.evalVars.message = message
      this.evalVars.db = guildDb.db
      guildDb.filters.catch( message.content, this.evalVars )
      guildDb.commands.convert( message.content, this.evalVars, roles => {
        if ( message.channel.type === `dm` )
          return false

        if ( message.author.id === message.guild.ownerID )
          return true

        for ( const role of roles ) {
          let roleObject = message.guild.roles.find( "name", role )
          let havingARole = roleObject  ?  message.member.roles.has( roleObject.id )  :  false

          if ( havingARole )
            return true
        }
      } )
    } )
    .on( `ready`, () => {
      console.log( `Bot has been started` )

      for ( const [ id, guild ] of c.guilds ) {
        this.guildsDbs.set( id, {
          commands: new Commands( id, config.prefix, config.spaceAfterPrefix ),
          filters: new Filters( id ),
          users: new Map,
          invites: null,
          db: {}
        } )

        guild.fetchInvites().then( invites => this.guildsDbs.get( id ).invites = invites )
      }

      c.user.setActivity( config.prefix, { type:'WATCHING' } )
    } )
    .on( `guildCreate`, guild => {
      this.guildsDbs.set( guild.id, {
        commands: new Commands( guild.id, config.prefix, config.spaceAfterPrefix ),
        filters: new Filters( guild.id ),
        users: new Map,
        invites: null,
        db: {}
      } )

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
    .login( config.token )
  }

  evalCmd( message, command ) {
    const guildDb = this.guildsDbs.get( message.guild.id )
    const cmds = guildDb.commands
    const vars = this.evalVars

    vars.db = guildDb.db
    vars.message = message

    cmds.convert( `${cmds.prefix}${cmds.prefixSpace  ?  ` `  :  ``}${command}`, vars, () => true )
  }
}