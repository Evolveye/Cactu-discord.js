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
 * And filters below */

;[
  { [/^#jeszczeraz$/i]() {
    $.evalCmd( `dialog jeszczeRaz` )
  } },
  { [/^#dlaczego$/i]() {
    $.evalCmd( `dialog dlaczego` )
  } },
  { [/^#otóżnie$/i]() {
    $.evalCmd( `dialog otozNie` )
  } },
  { [/^#ranfisz$/i]() {
    const channel = m.channel

    m.channel.bulkDelete( 2 ).then( () => channel.send( `Ranfisz mówi **stop** takim wiadomościom!` ) )
  } },
  { [/^#było$/i]() {
    $.evalCmd( `dialog bylo` )
  } },
  { [/^#smut$/i]() {
    $.evalCmd( `dialog smut` )
  } },
  { [/^#fbi$/i]() {
    $.evalCmd( `dialog fbi` )
  } },
  { [/#przegranko/]() {
    m.channel.send( '#jakdzban' )
  } },
  { [/#jeszczejak/]() {
    m.channel.send( '#jaknajbardziej' )
  } },
  { [/#jaknajbardziej|#cozadzban|#bardzobrzydko|#żenada|#niezna(m|sz)się/]() {
    m.channel.send( '#jeszczejak' )
  } },
  { [/#nieładnie|#nieznamcię/]() {
    m.channel.send( '#bardzobrzydko' )
  } },
  { [/#można/]() {
    m.channel.send( '#nawettrzeba' )
  } },
  { [/#nawettrzeba/]() {
    m.channel.send( '#nawetbardzo' )
  } },
  { [/#lol/]() {
    m.channel.send( '__***LEL.......***__' )
  } },
  { [/.+>{5,}.+/]() {
    m.channel.send( `${m.content}\nAle jak kto woli ¯\\\_(ツ)\_/¯` )
    m.delete()
  } },
  { [/teraz +teraz +teraz/i]() {
    m.channel.send( { files:[ `./files/teraz.mp4`] } )
  } },
  // { [/l[ _-]*i[ _-]*n[ _-]*u[ _-]*x *(?:n[ _-]*a[ _-]*j[ _-]*)?l[ _-]*e[ _-]*p[ _-]*s[ _-]*z[ _-]*y/i]() {
  //   m.channel.send( `❌ ***Kernel panic***` )
  //   m.delete()
  // } },


  /* *
   * Usable below */


  { [/discord\.gg\/.*/]() {
    m.delete();
  } },
  {
    [/#zaniepokojeniemocnobardzo/]() {
      m.channel.send( '#zaniepokojenie <:hue:380420995103850496>' )
    },
    [/#zaniepokojenie/]() {
      m.channel.send( `#zaniepokojeniemocnobardzo` )
    }
  },
  { [/^((?!(https?\:\/\/(www\.)?[\w\-\.\/]*\.\w{2,3}\/?)[^\s\b\n|]*[^.,;:\?\!\@\^\$ -]).)*$/]() {
    if (m.channel.id == `586292387198795934`) m.delete();
    else matched = false
  } },
  { [/c[i!]p[a@o0y]|(?<![^ ])c?h[vuo0ó]+j|k[vuo0ó]t[a@][$sz]|[kg][vuo0ó]re?[wv]|([wv]y)?p[i!]erd[o0]l|spierd|jprdl|jeb|r[vuo0ó]ch[a@]n[i!]e|p[p!]zd/i]() {
    if (m.channel.name == `weterani`) return matched = false

    const g = m.guild
    const roleId = g.roles.get( "586511781325963284" ).id
    const reg = /([^ ]*(?:c[i!]p[a@o0y]|(?<![^ ])c?h[vuo0ó]j|k[vuo0ó]t[a@][$sz]|[kg][vuo0ó]re?[wv]|([wv]y)?p[i!]erd[o0]l|spierd|jprdl|jeb|r[vuo0ó]ch[a@]n[i!]e|p[p!]zd)[^ ]*)/gi

    let vulgarism = false

    const content = `${m}`.replace( reg, matched => {
      if (/korwin|kotaszybkie|kurewkurnik/i.test( matched )) return matched

      vulgarism = true

      return `**${matched}**`
    } )

    if ( !vulgarism ) return matched = false

    const message = `**Filtr moderacyjny**: ${g} -- ${m.channel} -- ${m.author}:\n${content}`.replace( /\n/g, "\n> " )

    /** @type {Message[]} */
    const store = []
    const deleter = i => {
      let votes = 0

      for (const storedMessage of store)
        for (const reaction of storedMessage.reactions.values())
          if (reaction.count > 1) votes++

      if (votes >= store.length / 2) m.delete()
      else if (i < 10) setTimeout( () => deleter( i + 1 ), 1000 * 10 )
    }

    setTimeout( () => m.channel.fetchMessage( m.id ).then( async () => {
      for (const user of g.members.values())
        if (user.roles.has( roleId )) {
          const m = await user.send( message )
          m.react( `❌` )
          store.push( m )
        }

      deleter( 0 )
    } ), 1000 * 10 )
  } }
  // { [/xd/i]() {
  //   const rand = Math.random()
  //   const c = m.channel

  //   if ( rand > .8)
  //     c.send('Pisanie `xd` w takich ilościach jest na poziomie małży <:hue:380420995103850496>')
  //   else if ( rand > .6)
  //     c.send('Od was to nawet Odyn lepszy')
  //   else if ( rand > .4)
  //     c.send('xD w Ciebie')
  //   else if ( rand > .2)
  //     c.send('*haha* Ale z Ciebie somek')
  //   else
  //     c.send('Nie stać Cię na coś więcej niż pisanie "xd"?')

  // } }
]