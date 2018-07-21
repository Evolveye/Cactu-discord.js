import Discord from "discord.js"

import Commands from './Commands.mjs'
import Filters from './Filters.mjs'

/**@typedef {Object} filters Functions created according to the pattern: `[/regular expression/](){ <code> }`
 * @property {Function} regExp
 */
/**@typedef {Object} commands Commands structure
 * @property {String} prefix
 * @property {String} optionalParam
 * @property {String} restTypeParam
 * @property {String} deepestScope
 * @property {String} noCommand
 * @property {String} noParam
 * @property {String} badParam
 * @property {String} badRole
 * @property {String} help
 * @property {Function} commandMessenger
 * @property {Object} commands
 */

export default class CactuDiscordBot {
  /** Bot constructor
   * @param {Object} config
   * 
   * @param {filters[]} config.filters
   * @param {commands} config.commands
   * 
   * @param {Object} config.spamConfig
   * @param {String} config.spamConfig.roleId
   * @param {Number} config.spamConfig.interval
   * @param {Number} config.spamConfig.points
   * 
   * @param {String} config.token
   */
  constructor( config ) {
    let bot = this.discordClient = new Discord.Client
    let spamConfig = this.spamConfig = config.spamConfig  ||  { points:10 }
    let cache = this.cache = {
      clients: new Map,
      messages: new Map
    }

    this.filters = new Filters( config.filters  ||  {} )
    this.commands = new Commands( config.commands  ||  {} )

    bot.login( config.token )
    bot.on( `message`, message => {
      if (!(message.author.id in cache.clients)) {
        cache.clients.set( message.author.id, {
          lastMessageTime: 0,
          spamPoints: 0
        } )
      }

      let user = cache.clients.get( message.author.id )

      if (Date.now() - user.lastMessageTime < spamConfig.interval) {
        if (++user.spamPoints >= spamConfig.points) {
          if (`roleId` in spamConfig && bot.user.id != message.author.id)
            message.member.addRole( message.guild.roles.get( spamConfig.roleId ) )

          user.spamPoints = 0
        }
      } else {
        let pointsToRemove = Math.floor( (Date.now() - user.lastMessageTime) / 4000 )
        user.spamPoints -= user.spamPoints - pointsToRemove < 0  ?  user.spamPoints  :  pointsToRemove
      }
      
      if (message.author.bot)
        return

      let msg = message.content

      eval( this.filters.catch( message.content ) )
      eval( this.commands.convert( message.content, roles => {
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
      } ) )
    
      user.lastMessageTime = Date.now()
    } )
    bot.on( `ready`, () => {
      console.log( `Bot was run` )

      if (config.commands)
        bot.user.setActivity( config.commands.prefix, { type:'WATCHING' } )
    } )
  }
}