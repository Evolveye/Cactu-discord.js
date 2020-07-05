/* *
 * References for evaluation variables */

import fs from 'fs'
import https from 'https'
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
 * And the commands below */

;( {
  myLang: {
    $_loadSucces: `Yea, all is good!`,
    $_loadFail: `WRONG`
  },

  structure: {
    $: { // You can add own config to initial scope
      roles: `Admin`,
      desc: `God's commands`,

      tell( p={ text:`!!!` }, d=`Send message by the bot` ) {
        m.channel.send( text )
        m.delete()
      },
    },

    "!": { // Create new interesting scopes like in normal JS object (name can't have space!)
      roles: `Mod`,
      desc: `You may use it to moderate`,

      tell( p={ text:`!!!` }, d=`Send message by the bot` ) {ge
        if (/@everyone|@here/.test( text )) text = `Not today ;]`

        $.evalCmd( `$ tell ${text}` ) // Look! you can run command from the code!
      },
    },

    random( p={ range:`/\d+-\d+/` }, d=`Get the random number from *min-max* range` ) {
      let min = 1
      let max = 10

      if ( range ) {
        range = range.split( `-` )

        min = +range[ 0 ]
        max = +range[ 1 ]

        if ( min > max ) {
          min = +range[ 1 ]
          max = +range[ 0 ]
        }
      }

      m.channel.send( Math.floor( Math.random() * (max - min + 1) ) + min )
    }
  }
} )