/* *
 * References for evaluation variables */

import { Message } from "discord.js"
import CactuDiscordBot from "cactu-discord.js"

const $ = {
  /** Discord.Message instance
   * @type {Message} */
  message: {},

  /** CactuBot instance
   * @type {CactuDiscordBot} */
  bot: {},

  /** Scope for variables
   * @type {Any} */
  db: {}
}


/* *
 * And the filters below */

;[
  { [/.+>{5,}.+/] () {
    $.message.channel.send( `${message}\nBut what you want ¯\\\_(ツ)\_/¯` )
    $.message.delete()
  } },
  { [/#num/i] () {
    $.message.channel.send( $.numOfThatBoTRun ) // Variable from index.js
  } },
  { [/f[uvo]ck/i] () {
    $.message.delete()
  } /* Comma (and anything else) on the end (after next curly bracket) is forbidden! */ }
]