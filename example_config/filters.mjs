/* *
 * References for evaluation variables */

import { Message } from "discord.js"
import { GuildData } from "cactu-discord.js"

/** @type {Message} */
const m = Message
const $ = {
  /** Discord.Message instance
   * @type {Message} */
  message: {},

  /** Guild data
   * @type {GuildData} */
  guildData: {},

  /** Scope for variables */
  vars: {},

  /** Send message with sign on start
   * @param {string} status guild command without prefix
   */
  evalCmd( command ) {},

  /** Send message with sign on start
   * @param {String} message
   * @param {"error"|"warn"|"ok"} status
   */
  sendStatus( message, status=`ok` ) {},
}


/* *
 * And the filters below */

;[
  { [/.+>{5,}.+/]() {
    $.message.channel.send( `${$.message}\nBut what you want ¯\\\_(ツ)\_/¯` )
    $.message.delete()
  } },
  { [/f[uvo]ck/i]() {
    $.message.delete()
  } }
]