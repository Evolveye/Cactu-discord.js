import Discord from "discord.js"

import Commands from './Commands.mjs'



/** @typedef {Object} commandsStruct Commands structure
 * @property {String} [prefix]
 * @property {Boolean} [prefixSpace]
 * 
 * @property {Object} [lang] User translated sentences
 * @property {String} [lang.err_noCommand]
 * @property {String} [lang.err_badParam]
 * @property {String} [lang.err_noParam]
 * @property {String} [lang.err_badRole]
 * @property {String} [lang.help_optional]
 * @property {String} [lang.help_scope]
 * @property {String} [lang.help_rest]
 * @property {String} [lang.help]
 * @property {String} [lang.$_loadCommands]
 * @property {String} [lang.$_loadFilters]
 * @property {String} [lang.$_close]
 * 
 * @property {Function} [commandMessenger]
 * @property {Object} structure Only one required property
 */



export default class CactuDiscordBot {
  /** Bot constructor
   * @param {Object} config
   * 
   * @param {commandsStruct} [config.commands]
   * 
   * @param {Object} [config.spamConfig]
   * @param {String} [config.spamConfig.roleId]
   * @param {Number} [config.spamConfig.interval]
   * @param {Number} [config.spamConfig.points]
   * 
   * @param {String} config.token Only one required property
   */
  constructor( config ) {
    let discordClient = this.discordClient = new Discord.Client
    let spamConfig = this.spamConfig = config.spamConfig || { points:10 }
    let db = this.db = {
      clients: new Map,
      messages: new Map
    }

    discordClient
    .on( `message`, message => {
      if (!db.clients.has( message.author.id )) {
        db.clients.set( message.author.id, {
          lastMessageTime: 0,
          spamPoints: 0
        } )
      }

      let user = db.clients.get( message.author.id )

      if (Date.now() - user.lastMessageTime < spamConfig.interval) {
        if (++user.spamPoints >= spamConfig.points) {
          if (`roleId` in spamConfig && discordClient.user.id != message.author.id)
            message.member.addRole( message.guild.roles.get( spamConfig.roleId ) )
            
          user.spamPoints = 0
        }
      }
      else {
        let pointsToRemove = Math.floor( (Date.now() - user.lastMessageTime) / 4000 )
        user.spamPoints -= user.spamPoints - pointsToRemove < 0  ?  user.spamPoints  :  pointsToRemove
      }

      user.lastMessageTime = Date.now()

      if (message.author.bot)
        return

      //this.filters.catch( message.content, { message, db, bot:this } )
      this.commands.convert( message.guild.id, message.content, roles => {
        if (message.channel.type === `dm`)
          return false

        if (message.author.id === message.guild.ownerID)
          return true

        for (let role of roles) {
          let roleObject = message.guild.roles.find( "name", role )
          let havingARole = roleObject  ?  message.member.roles.has( roleObject.id )  :  false
    
          if (havingARole)
            return true
        }
      }, { message, db, bot:this } )
    } )
    .on( `ready`, () => {
      console.log( `Bot has been started` )

      let guildsIds = []
      for (let [ id ] of discordClient.guilds)
        guildsIds.push( id )

      this.commands = new Commands( guildsIds )

      if (config.commands)
        discordClient.user.setActivity( config.commands.prefix, { type:'WATCHING' } )
    } )
    .login( config.token )
  }
}