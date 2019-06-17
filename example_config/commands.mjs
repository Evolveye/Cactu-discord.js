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
 * And the commands below */

;( {
  myLang: {
    $_loadSucces: `✅ Yea, all is good!`,
    $_loadFail: `❌ WRONG`
  },

  structure: {
    $: { // You can add own config to initial scope
      roles: `Admin`,
      desc: `God's commands`,

      tell( p={ channelHash:`/<#\d{18}>(?:embeded)?/`, attachments:`/1|true/`, text:`!!!` }, d=`Send message by the bot` ) {
        let attachmentsUrls = []

        if ( attachments )
          for ( const att of $.message.attachments.keys() )
            attachmentsUrls.push( att.url )

        if ( /embeded$/.test( channelHash ) ) {
          try {
            $.bot.client.channels
            .find( `id`, channelHash.substring( 2, 20 ) )
            .send( { embed:eval( `(${text})` ), files:attachmentsUrls } )
          } catch {}
        }
        else if ( channelHash ) {
          $.bot.client.channels
          .find( `id`, channelHash.substring( 2,20 ) )
          .send( text, { files:attachmentsUrls } )
        }
        else
          $.message.channel.send( text, { files:attachmentsUrls } )

        $.message.delete()
      },
      edit( p={ channelHash:`/<#\d{18}>/`, botMessageId:/\d{18}/, newText:`!!!` }, d=`Edit the bot message` ) {
        let msg = $.message
        let channel = msg.channel

        if ( channelHash )
          channel = $.bot.client.channels.find( `id`, channelHash.substring( 2,20 ) )

        channel
        .fetchMessage( botMessageId )
        .then( msg => msg.edit( newText ) )
        .catch( () => msg.channel.send( `🤦 You propably gave me wrong ID` ) )
        msg.delete()
      },
      delete( p={ amount:/\d+/ }, r=`Owner`, d=`Delete messages` ) {
        let count = ++amount < 2  ?  2  :  (amount > 100  ?  100  :  amount)

        $.message.channel
        .bulkDelete( count )
        .then( deleted =>
          $.message.channel.send( `✅  **${deleted.array().length - 1}** messages have been deleted` )
        )
      },
      eval( p={ code:`!!!` }, r=`Owner`, d=`Evalueate the code` ){
        try {
          eval( code )
        }
        catch (err) {
          console.log( err )
        }
      },
    },

    "!": { // Create new interesting scopes like in normal JS object (but you can't use space)
      roles: `Mod`,
      desc: `You may use it to moderate`,

      delete( p={ amount:/\d+/ }, r=`Owner`, d=`Delete messages (3 max)` ) {
        const max = 3
        const count = ++amount < 2  ?  2  :  (amount > max + 1  ?  max + 1  :  amount)

        $.bot.evalCmd( $.message, `$ delete ${count}`) // Look! you can run command from the code!
      },
    },

    dm: {
      desc: `Directed messages commands`,

      clear( p={ range:/\d+/ }, d=`Clear the bot messages` ) {
        let limit = range < 1  ?  1  :  range > 30  ?  30  :  range

        $.message.author
        .createDM()
        .then( DM => DM
          .fetchMessages( { limit } )
          .then( msgs => {
            for (let msg of msgs)
              if (msg[1].author.bot)
                msg[1].delete()
          } )
        )
      },
      filters( d=`Gimme your filters, bot!` ) {
        const { filters } = $.bot.guildsDbs.get( $.message.guild.id )

        $.message.author.send( `*${filters.data.regExps.join( `*\n   *` )}*` )
      }
    },

    inviteMe( d=`Link zaproszeniowy bota` ) {
      $.message.channel.send( `https://discordapp.com/oauth2/authorize?client_id=379234773408677888&scope=bot&permissions=0` )
    },
    tell( p={ text:`!!!` }, r=`Deserved`, d=`Send message by the bot` ) {
      let m = $.message

      if ( /@everyone|@here/.test( text ) )
        text = `Not today ;]`

      m.channel.send( text )
      m.delete()
    },
    poolBreak( r=`Owner`, d=`Break the pool` ) {
      $.db.an_channel = null
      $.db.an_active = false
      $.message.channel.send( `Zatrzymano!` )
    },
    pool( // Inside that function I have used $.db for custom variables
      p={ seconds:`/[0-9]+/`, responses:`/\[[^\[\]]+\]/`, question:`!!!` },
      d=`Create the question pool \Responses may be created by pattern: [1|2|...|9]`
    ) {
      if ( $.db.an_active ) {
        $.message.channel.send( `👹 One question pool isn't ended!` )
        return
      }

      const minS = 10
      const maxS = 60 * 5

      if ( !seconds )
        seconds = minS

      if ( seconds > maxS )
        seconds = maxS

      if ( !responses )
        responses = `[Yes|No]`

      responses = responses.slice( 1, -1 ).split( `|` )
      $.db.an_channel = $.message.channel

      if ( responses.length > 9 ) {
        $.db.an_channel.send( `👹 Too much responses!` )
        return
      }

      const nums = ['1⃣','2⃣','3⃣','4⃣','5⃣','6⃣','7⃣','8⃣','9⃣']
      const responsesString = ( () => {
        let res = ``

        for ( const r of responses )
          res += `\n${nums[responses.indexOf( r )]} ${r}`

        return res
      } )()

      $.db.an_channel.send( `❔ ${question}${responsesString}` ).then( msg => {
        $.db.an_active = true

        for ( let i = 0;  i < responses.length;  i++ )
          ( i => setTimeout( () => msg.react( nums[i] ), i * 400 ) )( i )

        setTimeout( () => {
          if ( !$.db.an_active )
            return

          const response = `**Pool results**\n${question}\n`
          const reactions = msg.reactions

          for ( const reaction of reactions )
            response += `   ${reaction[0]} ${reaction[1].count-1} \n`

          $.db.an_channel.send( response )
          $.db.an_channel = null
          $.db.an_active = false
        }, seconds * 1000 )
      } )
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

      $.message.channel.send( Math.floor( Math.random() * (max - min + 1) ) + min )
    }
  }
} )