import canvasPackage from "canvas"
import fs from "fs"
import fetch from "node-fetch"

/** @typedef {import("discord.js").MessageReaction} MessageReaction */
/** @typedef {import("discord.js").User} User */
/** @typedef {import("discord.js").GuildMember} GuildMember */
/** @typedef {import("discord.js").Message} Message */
/** @typedef {import("discord.js").TextChannel} TextChannel */

/** @type {{authorId:string,time:number,message:Message,question:string}[]} */
const pools = []
const nums = ['1⃣','2⃣','3⃣','4⃣','5⃣','6⃣','7⃣','8⃣','9⃣']
const vulgarismReg = /([^\n ]*(?:c[i!]p[a@o0y]|(?<![^ ])c?h[vuo0ó][jy]|(?:[kg][vuo0ó]|q)t[a@][$sz]|(?:[kg][vuo0ó]|q)re?[wv]|([wv]y?)?p[i!]erd[o0a@]l|spierd|jprdl|jeb|r[vuo0ó]ch[a@]n[i!]e|p[i!]zd)[^\n ]*)/gi
const randomData = {
  lastStormRefresh: Date.now(),
  lastSomkaGówno: Date.now(),
  lastEmojiList: Date.now(),
  jamMessageId: ``,
  jamChannelId: ``,
  jamVotersIds: {},
  adminChase: {},
}

const { createCanvas, loadImage } = canvasPackage
const canvasRain = createCanvas( 845, 615 )
const ctxRain = canvasRain.getContext( `2d` )

const canvasKot = createCanvas( 50, 50 )
const ctxKot = canvasRain.getContext( `2d` )

async function latex( text, background=false ) {
  const address =`https://latex.codecogs.com/png.latex?`

  return Promise.resolve( loadImage( `${address}${encodeURIComponent( text )}` ) ).then( img => {
    const padding = 10
    const canvas = createCanvas( img.width + padding, img.height + padding )
    /** @type {CanvasRenderingContext2D} */
    const ctx = canvas.getContext( `2d` )

    ctx.fillStyle = `white`
    ctx.fillRect( 0, 0, img.width + padding, img.height + padding )

    if (!background) ctx.globalCompositeOperation = `destination-in`

    ctx.drawImage( img, padding / 2, padding / 2, img.width, img.height )

    return ctx
  } )
}
function getDate( format, date=Date.now() ) {
  const options = { year:`numeric`, month:'2-digit', day: '2-digit', hour:`2-digit`, minute:`2-digit` }
  const [ { value:DD },,{ value:MM },,{ value:YYYY },,{ value:hh },,{ value:mm } ] = new Intl.DateTimeFormat( `pl`, options )
    .formatToParts( date )

  return format
    .replace( /YYYY/, YYYY )
    .replace( /YY/, YYYY.slice( -2 ) )
    .replace( /MM/, MM )
    .replace( /DD/, DD )
    .replace( /hh/, hh )
    .replace( /mm/, mm )
}

/**
 * @module
 * @param {import("./GuildModules.js").UnsafeVariables} $
 * @returns {import("./GuildModules.js").GuildModule}
 */
export default $ => ({
  translation: {
    err_badParam:     `Niewłaściwy parametr!`,
    err_noCommand:    `To jest podzbiór poleceń, nie polecenie!`,
    err_noParam:      `Parametr wymagany nie został przekazany!`,
    err_noPath:       `Polecenie nie istnieje`,
    err_noPerms:      `Nie masz wymaganych uprawnień aby tego użyć!`,
    err_noPrefix:     `Nie umieściłeś prefixu`,
    err_invalidCmd:   `To polecenie ma źle napisany kod!`,
    err_error:        `Błąd!`,
    err_attachFile:   `Powinieneś załaczyć plik!`,
    help_title:       `Pomoc do wywołanego polecenia`,
    help_showMasks:   `Wyślij **??** jako pierwszy parametr polecenia aby zobaczyć jego opis`,
    help_params:      `Znak X**?** oznacza parametr opcjonalny, a **...**X dowolny ciag znaków`,
    help_masks:       `Jeśli nie wiesz czym są te rzeczy, mozesz zapytać kogoś z ekipy lub sprawdzić to na`,
    help_cmds:        `Polecenia`,
    help_scopes:      `Podzestawy poleceń`,
    footer_yourCmds:  `Spis Twoich spersonalizowanych poleceń po wpisaniu:`,
    footer_cmdInfo:   `Informacja na temat polecenia`,
    system_loadSucc:  `Plik został załadowany`,
    system_loadFail:  `Niewłaściwe dane pliku!`
  },
  events: {
    /**
     * @param {GuildMember} member
     */
    async guildMemberAdd( member ) {
      console.log( `memberadd` )
      member.roles.add( `739890394468450346` ) // sadzonka
    },

    /**
     * @param {MessageReaction} reaction
     * @param {User} user
     */
    async messageReactionAdd( reaction, user )  {
      if (user.id == `379234773408677888`) return
      if (reaction.partial) await reaction.fetch()

      const { message } = reaction

      if (message.author.id == `379234773408677888` && /mapId=/.test( message.content )) {
        const checkTime = variable => Date.now() - variable > 1000 * 30

        await message.reactions.removeAll()

        if (/images\.blitzortung\.org/.test( message.content ) && checkTime( randomData.lastStormRefresh )) {
          randomData.lastStormRefresh = Date.now()

          await message.edit( `http://images.blitzortung.org/Images/image_b_pl.png?mapId=${Date.now()}` )
        }

        await message.react( `🔄` )
      }
    },
  },
  filters: [
    {[/^((?!(https?\:\/\/(www\.)?[\w\-\.\/]*\.\w{2,3}\/?)[^\s\b\n|]*[^.,;:\?\!\@\^\$ -]).)*$/]() {
      const { id } = $.message.channel

      if ([ `586292387198795934`, `739633913831489587` ].includes( id )) {
        $.message.delete()
        $.setSharedData( `filtering`, false )
      } else if (id == `739895204303077497`) {
        const { guild, member } = $.message
        const channel_godowy = guild.channels.cache.get( "650009788280733712" )

        channel_godowy.send( `${member} odświeżył swój dostęp` )
        // member.roles.add( guild.roles.cache.get( `396723229739319296` ) ) // kaktus
        member.roles.add( guild.roles.cache.get( `739890394468450346` ) ) // sadzonka

        //$.message.delete()
        $.setSharedData( `filtering`, false )
      } else $.setSharedData( `filterMatch`, false )
    }},
    {[/discord\.gg\/.*|discord\.com\/invite/]() {
      $.message.delete()
      $.setSharedData( `filtering`, false )
    }},
    {[/^>> (?:\d{18}-)?\d{18}.*/]() {
      $.setSharedData( `filtering`, false )

      let m = $.message
      const { channelId, id, text } = m.content.match( /^>> (?:(?<channelId>\d{18})-)?(?<id>\d{18})(?<text>.*)/ ).groups
      let webhook

      const process = async () => {
        try {
          if (m.partial) m = await m.fetch()

          webhook = await m.channel.createWebhook( `CactuHaczyk`, {
            avatar:`https://cdn.discordapp.com/avatars/379234773408677888/a062f0b67e42116104554c1d3e3b695f.png?size=2048`
          } )
          /** @type {TextChannel} */
          const channel = channelId ? m.guild.channels.cache.get( channelId ) : m.channel
          const cite = channel.messages.cache.get( id ) || await channel.messages.fetch( id )

          if (cite.author.bot != false) {
            webhook.delete()
            m.channel.send( `Przykro mi ${m.member}, ale możesz cytować tylko ludzi` )
            return
          }

          const date = getDate( `hh:mm DD.MM.YYYY`, cite.createdAt )
          const hookData = {
            username: m.member.displayName,
            avatarURL: m.author.displayAvatarURL(),
            embeds: [ {
              // description: `**${cite.author} ${date}**\n${cite.content}`,
              description: `**${cite.author} napisał**:\n${cite.content}`,
              fields: [
                { name:`Link (jeśli nie działa, autor skasował wiadomość)`, value:m.url },
              ],
              timestamp: m.createdAt,
            } ],
          }

          await webhook.send( text, hookData )

          m.delete()
          webhook.delete()
        } catch (err) {
          if (webhook) webhook.delete()
          m.channel.send( `Przykro mi ${m.member}, ale na tym kanale nie ma wiadomosci o podanym ID\nTa wiadomość zniknie po 10 sekundach` )
            .then( msg => setTimeout( () => msg.delete(), 1000 * 10 ) )
        }
      }

      process()
    }},
    {[/Czarny nic nie robi/i]() {
        $.send( `https://wakatime.com/share/@2a3dfef1-cd57-4b40-889b-16bdb13601f8/a817d0e2-daf3-4f91-b620-37708d46f357.png?${Date.now()}` )
    }},
    {[/Paweł za dużo kodzi/i]() {
      $.send( `https://wakatime.com/share/@206424c8-210d-4dc2-aa56-4485f0d13e1b/d881e93b-40ba-4fda-ba3f-22bcac79b357.png?1?${Date.now()}` )
    }},
    {[/.+>{5,}.+/]() {
      $.send( `${$.message.content}\nAle jak kto woli ¯\\\_(ツ)\_/¯` )
      $.message.delete()
    }},
    {[/teraz +teraz +teraz/i]() {
      $.send( { files:[ `./files/teraz.mp4`] } )
    }},
    {
      [/#zaniepokojeniemocnobardzo/]() {
        $.send( '#zaniepokojenie <:hue:380420995103850496>' )
      },
      [/#zaniepokojenie/]() {
        $.send( `#zaniepokojeniemocnobardzo` )
      }
    },
    {[/<\w+>/i]() {
      const m = $.message
      let replaced = false

      if (m.author.bot || !m.guild) return

      const message = m.content.replace( /<\w+>/g, match => {
        const emojiName = match.slice( 1, -1 )
        let emoji = m.guild.emojis.cache.find( ({ name }) => name == emojiName )

        if (!emoji) $.botInstance.discordClient.guilds.cache.forEach( guild => {
          let e = guild.emojis.cache.find( ({ name }) => name == emojiName )

          if (e) emoji = e
        } )

        if (emoji) replaced = true

        return emoji || match
      } )

      if (replaced) {
        /** @type {TextChannel} */
        const channel = m.channel
        // m.channel.send( `**${m.member.displayName}**: ${message}` )
        // m.delete()

        // const send = () => {
        //   m.delete()

        //   $.vars.webhook.send( message, {
        //     username: m.member.displayName,
        //     avatarURL: m.author.avatarURL,
        //   } )
        // }

        channel.createWebhook( `CactuHaczyk`, { avatar:`https://cdn.discordapp.com/avatars/379234773408677888/a062f0b67e42116104554c1d3e3b695f.png?size=2048` } )
          .then( async webhook => {
            m.delete()

            await webhook.send( message, {
              username: m.member.displayName,
              avatarURL: m.author.displayAvatarURL(),
            } )

            return webhook
          } )
          .then( webhook => webhook.delete() )
          .catch( webhook => webhook.delete() )
      } else $.setSharedData( `filterMatch`, false )
    }},
    {[/^#jeszczeraz$/i]() {
      $.evalCmd( `dialog jeszczeRaz` )
    }},
    {[/^#dlaczego$/i]() {
      $.evalCmd( `dialog dlaczego` )
    }},
    {[/^#otóżnie$/i]() {
      $.evalCmd( `dialog otóżNie` )
    }},
    {[/^#ranfisz$/i]() {
      const { channel } = $.message

      channel.bulkDelete( 2 ).then( () => channel.send( `Ranfisz mówi **stop** takim wiadomościom!` ) )
    }},
    {[/^#było$/i]() {
      $.evalCmd( `dialog było` )
    }},
    {[/^#smut$/i]() {
      $.evalCmd( `dialog smut` )
    }},
    // {[/^#kupa$/i]() {
    {[/^#kupa$|^co$/i]() {
      if (/^co$/i.test( $.message.content )) {
        if ($.message.author.id == `389814624662454285` && Date.now() - randomData.lastSomkaGówno > 1000 * 30) {
          randomData.lastSomkaGówno = Date.now()

          $.send( `**Somek napisał "co"** a nasza wewnętrznie skrywaną odpowiedzią jest:`)
          $.evalCmd( `dialog kupa` )
        }

        return
      }

      $.evalCmd( `dialog kupa` )
    }},
    {[/^#fbi$/i]() {
      $.evalCmd( `dialog fbi` )
    }},
    {[/^walczcie!$/i]() {
      $.send( { files:[ `./files/walczcie.mp4`] } )
    }},
    {[/#przegranko/]() {
      $.send( '#jakdzban' )
    }},
    {[/#jeszczejak/]() {
      $.send( '#jaknajbardziej' )
    }},
    {[/#jaknajbardziej|#cozadzban|#bardzobrzydko|#żenada|#niezna(m|sz)się/]() {
      $.send( '#jeszczejak' )
    }},
    {[/#nieładnie|#nieznamcię/]() {
      $.send( '#bardzobrzydko' )
    }},
    {[/#można/]() {
      $.send( '#nawettrzeba' )
    }},
    {[/#nawettrzeba/]() {
      $.send( '#nawetbardzo' )
    }},
    {[/\/\(.*?\/\)/gs]() {
      const m = $.message
      const reg = /(?:^|(.+?))(?:\/\((.+?)\/\)|$)/syg

      m.delete()

      const process = async () => {
        try {
          const webhook = await m.channel.createWebhook( `CactuHaczyk`, {
            avatar:`https://cdn.discordapp.com/avatars/379234773408677888/a062f0b67e42116104554c1d3e3b695f.png?size=2048`
          } )
          const hookData = {
            username: m.member.displayName,
            avatarURL: m.author.displayAvatarURL(),
          }

          let res = null
          while (res = reg.exec( m.content )) {
            const [ text=``, latexCode ] = res.slice( 1 )
            const { canvas } = await latex( latexCode )
            const options = latexCode ? { files:[ canvas.toBuffer() ], ...hookData } : hookData

            await webhook.send( text, options )
          }

          webhook.delete()
        } catch (err) {
          // console.log( err )
          m.channel.send( `Oj, ${m.member} chyba nie umiesz robić równań bo coś jest z nim nie tak\n> ${m.content}\n\n Ta wiadomość zniknie po 10 sekundach` )
            .then( msg => setTimeout( () => msg.delete(), 1000 * 10 ) )
        }
      }

      process()
    }},
    {[/#lol/]() {
      $.send( '__***LEL.......***__' )
    }},
    {[vulgarismReg]() {
      const m = $.message

      if (m.channel.name == `weterani`) return $.setSharedData( `filterMatch`, false )

      const g = m.guild
      let vulgarism = false

      const content = `${m}`.replace( vulgarismReg, matched => {
        if (/korwin|kotaszybkie|kurewkurnik/i.test( matched )) return matched

        vulgarism = true

        return `**${matched}**`
      } )

      if (!vulgarism) return $.setSharedData( `filterMatch`, false )

      /** @param {Message} notNiceMsg */
      const warnSender = async notNiceMsg => {
        if (!notNiceMsg) return

        // const warnText = `Przyzywam was strażnicy pokoju: ${inkwizycja}`
        const embed = {
          title: `${$.botInstance.signs.warn}  Filtr moderacyjny`,
          color: 0xff0000,
          fields: [
            { name:`Cytat`, value:`> ${content}` },
            { name:`Wiadomość`, value:`${notNiceMsg.url}` },
            { name:`Serwer`, value:`${notNiceMsg.guild}`, inline:true },
            { name:`Kanał`, value:`${notNiceMsg.channel}`, inline:true },
            { name:`Autor`, value:`${notNiceMsg.member}`, inline:true },
          ]
        }

        const members = await g.members.fetch()

        members.filter( ({ roles }) => roles.cache.has( `586511781325963284` ) )
          .forEach( member => member.createDM().then( dm => dm.send( { embed } ) ) )

        // /** @type {Message} */
        // const sendedWarn = await g.channels.get( `650009788280733712` ).send( warnText, { embed } )
        // const deleter = (iteration=0) => {
        //   if (sendedWarn.reactions.get( `❌` ).count > 1) return notNiceMsg.delete()
        //   if (iteration < 12) setTimeout( () => deleter( iteration + 1 ), 1000 * 5 )
        // }

        // await sendedWarn.react( `❌` )

        // deleter()
      }

      setTimeout( () => warnSender( m.channel.messages.cache.get( m.id ) ), 1000 * 10 )
    }}
  ],
  commands: {
    $: { d:`Umiejętności mistycznego oka`, r:`@owner`, v:{
      load: { d:`Wyczyść wszystkie dane modułów i załaduj nowy moduł z dołączonego pliku` },
      tell: { d:`Wyślij wiadomość poprzez bota`, v( channelHash=/<#\d{18}>/g, text=/.+/ ) {
        const message = $.message
        const { guild, attachments } = message
        const attachmentsUrls = []
        let { channel } = message

        if (attachments.size) for ( const { url } of attachments.values() ) attachmentsUrls.push( url )
        if (channelHash) channel = guild.channels.cache.find( channel => channel.id == channelHash.substring( 2, 20 ) )

        if (/^embeded /.test( text )) {
          try {
            channel.send( { files:attachmentsUrls, embed:eval( `(${text.slice( 7 )})` ) } )
          } catch {
            throw `Coś jest nie tak z embedem, którego próbujesz wysłać`
          }
        } else channel.send( text, { files:attachmentsUrls } )

        message.delete()
      }},
      edit: { d:`Zastąp wiadomość bota z dowolnego kanału treścią innej wiadomości`, v( botMsgChannel=/<#\d{18}>/, botMsgToEditId=/\d{18}/, msgToCopyId=/\d{18}/) {
        const message = $.message
        const channel = message.guild.channels.cache.find( channel => channel.id == botMsgChannel.substring( 2, 20 ) )

        message.channel.messages.fetch( msgToCopyId )
          .then( msgToCopy => channel.messages.fetch( botMsgToEditId )
            .then( msg => msg.edit( msgToCopy.content ) )
            .then( () => message.delete() )
            .catch( () => channel.send( `🤦 Chyba podałeś mi złe ID` ) )
          )
          .catch( () => channel.send( `🤦 Na mogę skopiować wiadomości o tym ID z tego kanału` ) )
      }},
      delete: { d:`Skasuj wiadomości`, v( amount=/\d+/ ) {
        const message = $.message
        const count = ++amount < 2
          ? 2
          : amount > 100
          ? 100
          : amount

        message.channel.bulkDelete( count )
          .then( deleted => {
            const countOfDeleted = deleted.size - 1
            let endOfMsg = `ostatnich wiadomości`

            if ( countOfDeleted == 1 ) endOfMsg = `ostatnią wiadomość`
            else if ( countOfDeleted < 5  ) endOfMsg = `ostatnie wiadomości`

            $.sendOk( `Usunięto **${deleted.array().length - 1}** ${endOfMsg}`, message.channel )
          } )
      }},
      eval: { d:`Ewaluuj wysłany w wiadomości kod`, v( code=/.+/ ) {
        const m = $.message
        const s = $.send

        try {
          eval( /```.+```/s.test( code ) ? code.match( /\n(.*)```/s )[ 1 ] : code )
        } catch (err) {
          const error = err.stack.split( `\n` )[ 1 ]
            .split( /-/ )
            .slice( -1 )[ 0 ]
            .slice( 0, -1 )
          m.reply( `chyba nie potrafisz programować EH PANOWIE\n> ${error}` )
        }
      }},
    }},
    "!": { d:`Umiejętności zarządu`, r:`Admine`, v:{
      gimmeAdmin: { d:`Daj sobie prawa administratora na kanale użytkownika`, v() {
        /** @type {TextChannel} */
        const channel = $.message.channel

        if (channel.parentID !== `756592120466505789`) {
          throw `To nie jest kanał w sekcji użytkownika ;-;`
        }

        channel.updateOverwrite( $.message.author, {
          "MANAGE_CHANNELS": true,
        } ).then( () => $.sendOk( `Zostałeś administratorem` ) )
      }},
      chase: { d:`Dodaj użytkownikowi punkty pościgu. Maksymalna ich ilość skończy się banem`, v( userPing=/<@!?\d{18}>/, points=/[1-9]/g ) {
        const chase = randomData.adminChase
        const max = 10
        const time = 1000 * 60 * 60 * 1

        if (!(userPing in chase))
          chase[ userPing ] = {
            points: 0,
            lastChase: Date.now()
          }

        const user = chase[ userPing ]

        if (Date.now() - user.lastChase >= time) {
          user.points -= Math.floor( (Date.now() - user.lastChase) / time )

          if (user.points < 0) user.points = 0
        }

        user.points += points || 1
        user.lastChase = Date.now()

        if (max - user.points >= 0)
          m.channel.send( `${`🕳`.repeat( max - user.points )}${`<:cactu:465903558873710592>`.repeat( user.points )}` )
        else m.channel.send( `No to ban <:zeber:484783723468816394>` )
      }},
      getUsers: { d:`Sporządź listę użytkowników z lub bez roli fertycznego kaktusa`, v( query=/a|active|u|unactive/ ) {
        const m = $.message
        let count = 0
        let list = ""

        m.channel.guild.members.forEach( member => {
          const haveRole = member.roles.find( ({ name }) => name === `Fertyczny kaktus` )

          if (/a|active/.test( query ) && !haveRole) return
          else if (/u|unactive/.test( query ) && haveRole) return

          list += member.displayName + `     `
          ++count
        } )

        m.channel.send( `Znaleziono **${count} użytkowników**:\n${list}` )
      }},
    }},
    fun: { d:`Polecenia bez sensownego zastosowania, ot próżna zabawa`, v:{
      emojis: { d:`Stwórz listę dostępnych emoji`, v() {
        if (randomData.lastEmojiList > Date.now() - 1000 * 60 * 30)
        randomData.lastEmojiList = Date.now()

        const m = $.message
        const data = []
        let count = 0

        $.botInstance.discordClient.guilds.cache.forEach( (guild) => {
          const emojis = []

          guild.emojis.cache.forEach( ({ id, name, animated }) => {
            const field = `\`${name}\` <${animated ? `a` : ``}:${name}:${id}>`
            const offset = ` `.padStart( 20 - name.length )

            emojis.push( `${field} \`${offset}\`` )
          } )

          count += emojis.length
          data.push( { guild:guild.name, emojis } )
        } )

        m.channel.send( ``
          + `Znaleziono **${count}** emotikon\n`
          + `Aby użyć któregoś z tych emoji wpisz <nazwa_emoji>`
        )

        data.forEach( ({ guild, emojis }) => {
          if (!emojis.length) return

          m.channel.send( `> **${guild}**:` )

          for (let i=0;  i < emojis.length;  i+=25) {
            m.channel.send( emojis.slice( i, i + 25 ).join( ` ` ) )
          }
        } )
      }},
      spoiler: {d:`Zrób spoilerową szachownicę`, v( text=/.+/ ) {
        let msg = ``

        for (const char of text.split( `` )) msg += `||${char}||`

        $.send( `${$.message.member.displayName} utworzył szachownicę: \n${msg}` )
        $.message.delete()
      }},
      secret: {d:`Zaszyfruj wiadomość usuwajac z niej część literek`, v( text=/.+/ ) {
        $.send( `${$.message.member.displayName} napisał szyfr: ${text.replace( /a|e|i|o|u|y|ą|ę|ó/gi, `` )}` )
        $.message.delete()
      }},
      stone: {d:`Rzuć kamieniem w kogoś `, v() {
        const { channel, member } = $.message
        const msgs = Array.from( channel.messages.cache.last( 3 ).values() )
        const chance = Math.random()
        let nickname = ``

        if (chance >= .85) nickname = msgs[ 2 ].member.displayName
        else if (chance >= .6) nickname = msgs[ 1 ].member.displayName
        else if (chance >= .4) nickname = msgs[ 0 ].member.displayName

        if (chance >= .95 || nickname == member.displayName) nickname = `**xD z typa** bo sam od siebie`

        const addon = nickname ? `${nickname} oberwał` : `Pudło 🤦`

        channel.send( `*${member.displayName} rzuca kamieniem*    (╯°□°）╯<:stone:539048004011687939> \n${addon}` )
        $.message.delete()
      }},
      oko: {d:`Zaszyfruj wiadomość usuwajac z niej część literek`, v() {
        $.message.channel.send( `<:oko:447037988715757569>` )
          .then( async msg => {
            msg.edit( `<:oko:447037988715757569>` )
            await new Promise( res => setTimeout( res, 1500 ) )
            msg.edit( `🧿` )
            await new Promise( res => setTimeout( res, 2000 ) )
            msg.delete()
          } )
        $.message.delete()
      }},
      kot: {d:`Złap się za głowę`, v() {

      }},
    }},
    dialog: { d:`Wyślij wstawkę, która może pasować do rozmowy`, v:{
      hashes: { d:`Z utworzonych przez administratora filtrów stwórz listę tych które sprawdzają hashtagi`, v() {
        const lists = {
          withCaret: [],
          withoutCaret: []
        }

        $.guildModules.filters.forEach( scope => scope
          .filter( ({ regExp }) => /^\/\^?#/.test( `${regExp}` ) )
          .map( ({ regExp }) => ({ r:`${regExp}`, caret:/^\/\^/.test( `${regExp}` ) }) )
          .forEach( ({ r, caret }) => lists[ caret ? `withCaret` : `withoutCaret` ].push( `> ${r}` ) )
        )

        lists.withCaret.sort( (a, b) => b.length - a.length )
        lists.withoutCaret.sort( (a, b) => b.length - a.length )

        $.send( `**Lista filtrów (wyrażeń regularnych) wyłapujących hashtagi**: \n${lists[ `withoutCaret` ].join( `\n` )}\n${lists[ `withCaret` ].join( `\n` )}` )
      }},
      było: { d:`A było było`, v() {
        $.send( `https://youtu.be/odRjw1i9s3Q` ).then( () => $.message.delete() )
      }},
      teraz: { d:`TERAZ TERAZ TERAZ`, v() {
        $.send( { files:[ `./files/teraz.mp4`] } ).then( () => $.message.delete() )
      }},
      nobody: { d:`Nikt nie spodziewał się inkwizycji`, v() {
        $.send( `https://www.youtube.com/watch?v=I-uXPcWdKUY&feature=youtu.be&t=58` ).then( () => $.message.delete() )
      }},
      creeper: { d:`Smutek gdy zobaczysz creepera`, v() {
        $.send( { files:[ `./files/creeper.mp3` ] } ).then( () => $.message.delete() )
      }},
      fbi: { d:`Open up!`, v() {
        $.send( { files:[ `./files/fbi_open_up.mp3` ] } ).then( () => $.message.delete() )
      }},
      wegothim: { d:`Ladies & Gentlemen.... We Got Him`, v() {
        $.send( `https://www.youtube.com/watch?v=-15VC4Yxzys&feature=youtu.be&t=13` ).then( () => $.message.delete() )
      }},
      hehiha: { d:`Heheszkowa muzyka`, v() {
        $.send( { files:[ `./files/hahahohohihihehe.mp3` ] } ).then( () => $.message.delete() )
      }},
      kiss: { d:`Pocałuj mnie wiesz gdzie`, v() {
        $.send( { files:[ `./files/kiss_me.mp3` ] } ).then( () => $.message.delete() )
      }},
      hell: { d:`Zaraz rozpęta sie tu prawdziwe piekło`, v() {
        $.send( { files:[ `./files/prawdziwy_hell.mp3` ] } ).then( () => $.message.delete() )
      }},
      smut: { d:`Przykra sprawa`, v() {
        $.send( { files:[ `./files/przykra_sprawa.mp3` ] } ).then( () => $.message.delete() )
      }},
      kretyni: { d:`Po prostu kretyni`, v() {
        $.send( { files:[ `./files/kretyni.mp3` ] } ).then( () => $.message.delete() )
      }},
      aleBymWam: { d:`... wszystkim na tym czacie`, v() {
        $.send( { files:[ `./files/ale_bym_wam_na_tym_czacie.mp3` ] } ).then( () => $.message.delete() )
      }},
      kupa: { d:`Odchody`, v() {
        $.send( { files:[ `./files/kupa.mp3` ] } ).then( () => $.message.delete() )
      }},
      wnerwia: { d:`Ale to wnerwia`, v() {
        $.send( { files:[ `./files/triggered.mp3` ] } ).then( () => $.message.delete() )
      }},
      dlaczego: { d:`Dlaczego to zrobiłeś`, v() {
        $.send( { files:[ `./files/dlaczego.mp3` ] } ).then( () => $.message.delete() )
      }},
      jeszczeRaz: { d:`Mozesz to jeszcze raz zrobić?`, v() {
        $.send( { files:[ `./files/jeszcze_raz.mp3` ] } ).then( () => $.message.delete() )
      }},
      otóżNie: { d:`Otóż nie`, v() {
        $.send( { files:[ `./files/1z10_nie.mp3` ] } ).then( () => $.message.delete() )
      }},
      walczcie: { d:`A kto wygra, tego czeka nagroda`, v() {
        $.send( { files:[ `./files/walczcie.mp4` ] } ).then( () => $.message.delete() )
      }},
      potężny: { d:`Tylko jeden jest potężny`, v() {
        $.send( { files:[ `./files/potężny.mp4` ] } ).then( () => $.message.delete() )
      }},
    }},
    poll: { d:`Polecenia zwiazane z tworzeniem ankiety`, v:{
      examples: { d:`Zobacz przykładowe konstrukcje ankiet`, v() {
        const header = ``
          + ` Tworzenie ankiet wymaga nieco wiecej wiedzy na temat budowania poleceń, niż wiele innych.`
          + ` Pierwszym parametrem jest czas mierzony w minutach (liczba naturalna). Czas ten nie może przekroczyć 1440 minut (jeden dzień).`
          + ` Dalej należy wpisać treść pytania. Może to być dowolny ciag znaków lecz nie moze posiadać podwójnych wcięć.`
          + ` Wyjątkiem od podania przynajmniej 2 wcięć jest sytuacja, w której chcesz podać własne odpowiedzi.`
          + ` Własne odpowiedzi tworzysz właśnie poprzez oddzielenie ich przynajmniej podwójnym przerwaniem linii i wpisaniu jednej odpowiedzi w jednej linii.`
          + `\n`
          + `\nW poniższych przykładach *<wyzwalacz>* oznacza polecenie które wyzwala polecenie tworzenia ankiety.`

        const example1 = "```"
          + `<wyzwalacz> Najprostsza ankieta trwająca 5 minut`
          + "```"
        const example2 = "```"
          + `<wyzwalacz> 60 Ankieta trwająca godzinę`
          + "```"
        const example3 = "```"
          + `<wyzwalacz> 60 Ankieta trwająca godzinę i mająca niestandardowe odpowiedzi\n`
          + `\n`
          + `Tak\n`
          + `Jak najbardziej\n`
          + `To oczywiste!\n`
          + "```"

        $.send( header + example1 + example2 + example3 )
      }},
      create: { d:`Stwórz ankietę`, v( minutes=/\d{1,4}/g, questionWithResponses=/.+/ ) {
        const message = $.message

        let min = 1
        let max = 1440

        if (!minutes) minutes = min
        if (minutes < min) minutes = min
        if (minutes > max) minutes = max

        /** @type {string[]} */
        const partedInput = questionWithResponses.split( /\n\n/g )
        const question = partedInput.length == 1 ? partedInput[ 0 ] : partedInput.slice( 0, -1 )
        const responses = partedInput.length == 1 ? [`Tak`, `Nie`] : partedInput.slice( -1 )[ 0 ].split( /\n/g )
        const responsesString = responses.map( (res, i) => `     ${nums[ i ]}  ${res}` ).join( `\n` )

        const now = Date.now()
        const content = `❔  ${question}\n*Czas na odpowiedź w minutach: ${minutes}*\n\n${responsesString}\n     -   -`

        message.delete()
        message.channel.send( content ).then( async m => {
          for (let i = 0; i < responses.length; i++) await m.react( nums[ i ] )

          m.react( `⬛` )

          pools.push( { authorId:message.author.id, time:now, message:m, question } )

          setTimeout( () => $.evalCmd( `pool break ${m.id}` ), 1000 * 60 * minutes )
        } )
      }},
      break: { d:`Zatrzymaj ankietę jako członek ekipy serwera lub twórca ów ankiety`, v( messageId=/\d{18}/g ) {
        const poolIndex = messageId
          ? pools.findIndex( ({ message }) => message.id === messageId )
          : pools.findIndex( ({ authorId }) => authorId === $.message.author.id )

        if (poolIndex >= 0) {
          const { message, question } = pools.splice( poolIndex, 1 )[ 0 ]
          const reactions = message.reactions.cache
          let response = ``

          reactions.delete( `⬛` )

          for (const reaction of reactions) response += `   ${reaction[ 0 ]} ${reaction[ 1 ].count - 1} \n`

          message.channel.send( `**Odpowiedź na ankietę o treści**:\n❔  ${question}\n\n${response}` )
        }
      }}
    }},
    jam: { d:`Strefa CactuJam`, v:{
      open: { d:`Otwórz zapisy na zawody`, r:`Owner`, v() {
        const m = $.message
        /** @type {TextChannel} */
        const jamChannel = m.guild.channels.cache.get( `478209069954367498` )

        jamChannel.send( "``` ```"
          + `\n**Można składać podania o uczestnictwo w zawodach CactuJam!**`
          + `\n`
          + `\nKażdy zainteresowany (czyli taki ktoś, kto chciałby wziąć udział a nie jest kimś, kto weźmie udział na 100% -`
          + ` np. gdy uczestnictwo zależy od terminu) możne zostawić kaktusową reakcję.`
          + `\nUstalenia rozpoczną się po zebraniu bliżej nieokreślonej liczby chętnych`
          + "\n\n``` ```"
        ).then( m => m.react( m.guild.emojis.cache.find( ({ name }) => name === `cactu` ) ) )

        jamChannel.setName( `cactujam-zapisy` )
      }},
      dateChoosing: { d:`Wygeneruj prostą ankietę na kilka następnych tygodni i rozpocznij ustalenia tematów ogólnych`, r:'Owner', v( openInfoMsgId=/\d{18}/, howMany=/[1-9]$/ ) {
        if (!howMany) howMany = 4

        const m = $.message
        /** @type {TextChannel} */
        const jamChannel = m.guild.channels.cache.get( `478209069954367498` )// .get( `478209069954367498` )
        const nums = ['1⃣','2⃣','3⃣','4⃣','5⃣','6⃣','7⃣','8⃣','9⃣']
        const date = new Date
        const now = Date.now()
        const day = 1000 * 60 * 60 * 24
        const daysToFriday = 5 - date.getDay()
        const fridays = Array( howMany ).fill( 1 ).map( (_, i) => new Date( now + daysToFriday + day * (i + 1) * 7 ) )
        const twoDigitNum = num => `${num}`.length == 2 ? num : `0${num}`
        const getDateTime = date => `${twoDigitNum( date.getDate() )}.${twoDigitNum( date.getMonth() + 1 )}.${date.getFullYear()}`

        jamChannel.messages.fetch( openInfoMsgId ).then( msg => {
          for (const reaction of msg.reactions.cache.values() ) reaction.users.cache
            .map( user => m.guild.member( user ) )
            .forEach( member => member.roles.add( `552076455731789839` ) )
        } )

        jamChannel.updateOverwrite( `396723229739319296`, { VIEW_CHANNEL:false } )
        jamChannel.updateOverwrite( `552076455731789839`, { SEND_MESSAGES:true } )

        jamChannel.send( ``
          + `**Przyszedł czas na ustalenia**`
          + `\n Jeśli ktoś ma propozycję odnośnie odgórnego tematu (który będzie obok losowanych w dzień startu),`
          + ` lub jakikolwiek inny pomysł odnośnie jamu - może to zaproponować teraz`
          + `\n`
          + `\n**Przykładowe daty startu** (przykładowe, ponieważ inne także można proponować):`
          + fridays.reduce( (str, item, i) => `${str}\n    **${i + 1}#** ${getDateTime( item )}`, `` )
        ).then( async m => {
          for (let i = 0; i < howMany; i++) await m.react( nums[ i ] )
        } )

        jamChannel.setName( `cactujam-ustalenia` )
      }},
      vote: { d:`Oddaj głos na uczestnika CactuJamu`, v( nickOrNumber=/[\d\w]+/, subjectPoints=/[0-2]+/, gameplayPoints=/[0-4]+/, audiovisualPoints=/[0-4]+/ ) {
        const m = $.message
        const { jamMessageId, jamChannelId, jamVotersIds } = randomData
        const nickname = m.member.displayName.replace( / /g, `_` )

        if (!jamMessageId || !jamChannelId) throw `Nie została ustawiona wiadomość, w której zbierane są głosy!`

        /*
          ```py
          @  Punktacja

          [1] # Oko
              > Oko        10 10 10
              > Rybełek     0  0  0
              > Czarnuch    0  0  0

          [2] # Staś
              > Oko        0  0  0
              > Rybełek   10 10 10
              > Czarnuch  10 10 10
          ```
        */

        let newContent = '```py\n'
        let voterIndices = {}
        /** @type {TextChannel} */
        const voteChannel = m.guild.channels.cache.get( jamChannelId )
        const updateContent = (voterStr, subject, gameplay, audiovisual) => newContent += ''
          + `\n${voterStr} `
          + ` ${subject}`
          + ` ${gameplay}`
          + ` ${audiovisual}`

        voteChannel.messages.fetch( jamMessageId ).then( msg => {
          const usersVotes = msg.content.match( /((?<=\n\[).+?(?=\n +-))+/gs )
          const labels = []
          const subjectPointsMultiplier = 4
          const gameplayPointsMultiplier = 2
          const audiovisualPointsMultiplier = 1
          const voter = nickname
          let voterLastNick = voter
          let voted = false

          if (m.member.id in jamVotersIds) {
            voterLastNick = jamVotersIds[ m.member.id ].nick
            voterIndices = jamVotersIds[ m.member.id ].indices
          }

          usersVotes.forEach( scopes => {
            const lines = scopes.split( '\n' )

            const { index, nick } = lines.shift().match( /(?<index>\d+)]#(?<nick>.+)/ ).groups
            const votes = {
              ' calctulated': { subject:0, gameplay:0, audiovisual:0 },
              ' total': { subject:0, gameplay:0, audiovisual:0 }
            }

            const t = votes[ ' total' ]
            const voteIsForHim = nickOrNumber == index || nickOrNumber == nick
            const voterIndex = voterIndices[ index ]
            let voterFounded = false

            newContent += `\n[${index}]#${nick}`

            lines.forEach( (vote, i) => {
              const parsed = vote.match( /> *(?<voter>.+?) +(?<subject>\d+) +(?<gameplay>\d+) +(?<audiovisual>\d+)/ ).groups

              let voterNick = parsed.voter
              let subject =+ parsed.subject
              let gameplay =+ parsed.gameplay
              let audiovisual =+ parsed.audiovisual

              if (voterNick == voterLastNick && (!voterIndex || voterIndex == i)) {
                voterNick = voter

                if (voteIsForHim) {
                  voterIndices[ index ] = i
                  voterFounded = true
                  voted = true

                  subject =+ subjectPoints
                  gameplay =+ gameplayPoints
                  audiovisual =+ audiovisualPoints
                }
              }

              t.subject += subject
              t.gameplay += gameplay
              t.audiovisual += audiovisual

              votes[ voterNick ] = { subject, gameplay, audiovisual }

              updateContent( `> ${voterNick}`, subject, gameplay, audiovisual )
            } )

            if (!voterFounded && voteIsForHim) {
              voted = true
              updateContent( `> ${voter}`, subjectPoints, gameplayPoints, audiovisualPoints )

              t.subject += subjectPoints
              t.gameplay += gameplayPoints
              t.audiovisual += audiovisualPoints
            }

            votes[ ' calctulated' ] = 0
              + t.subject * subjectPointsMultiplier
              + t.gameplay * gameplayPointsMultiplier
              + t.audiovisual * audiovisualPointsMultiplier

            newContent += `\n${' -'.repeat( 7 )}`

            if (lines != 0 || (!voterFounded && voteIsForHim)) {
              //updateContent( ' ', t.subject, t.gameplay, t.audiovisual )
              newContent += ` => ${votes[ ' calctulated' ]}`
            }

            labels[ index ] = votes
            labels[ nick ] = votes
          } )

          newContent += '```'

          if (voted) {
            const link = `https://discordapp.com/channels/${voteChannel.guild.id}/${jamChannelId}/${jamMessageId}`

            $.sendOk( `Głos oddany prawidłowo (${nickname} -> ${subjectPoints} ${gameplayPoints} ${audiovisualPoints})\nWiadomość zniknie za 5s\n${link}` )
              .then( msg => setTimeout( () => {
                m.delete()
                msg.delete()
              }, 1000 * 5 ) )
          }
          else throw `Nie znaleziono uczestnika którego wskazałeś`

          msg.edit( newContent )
        } ).then( () => jamVotersIds[ m.member.id ] = {
          nick: nickname,
          indices: voterIndices
        } )
      }},
      startVoting: { d:`Ustaw wiadomość startową dla gosowania`, r:`Owner`, v( participants=/.+/ ) {
        const m = $.message
        let content = 'Po raz ostatni musicie zmierzyć się z tymże jakże topornym systemem oceniania (oby ostatni).\n```py\n @  Punktacja'

        participants.split( ' ' ).forEach( (participant, i) => content += `\n\n[${i + 1}] # ${participant}\n    ${' -'.repeat( 7 )}` )

        m.channel.send( content + '```' ).then( msg => {
          randomData.jamMessageId = msg.id
          randomData.jamChannelId = msg.channel.id
          randomData.jamVotersIds = {}
        } )
      }},
      setVotingMsg: { d:`Ustaw wiadomość bota, do której wpisywane są głosy`, r:`Owner`, v( messageId=/\d{18}/, channelId=/\d{18}/g ) {
        randomData.jamMessageId = messageId
        randomData.jamChannelId = channelId || msg.channel.id
        randomData.jamVotersIds = {}
      }},

      // info( r=`Owner`, d=`Wygeneruj wiadomość inicjującą zawody. Dodatki do zajmowanego miejsca powinna poprzedzań cyfra z dwukropiem (np. "1: coś")`, p={
      //   number: /\d+/,
      //   subject: /"[^"]+"/,
      //   assets: /"[^"]+"/,
      //   endTime: /\d\d:\d\d/,
      //   endDate: /\d\d\.\d\d\.\d\d\d\d/,
      //   additional: `/"[^0-9][^"]+"/`,
      //   infoForPlaces: `/\d+: *\S[\s\S]*/`
      // } ) {
      //   const date = new Date
      //   const jamChannel = m.guild.channels.get( `478209069954367498` )
      //   const twoDigitNum = num => `${num}`.length == 2 ? num : `0${num}`
      //   const placesInfo = !infoForPlaces ? [] : infoForPlaces
      //     .match( /\d+: *[\s\S]+?(?= *\d+:|$)/g )
      //     .map( match => match.split( /: */ ) )
      //     .sort( (a, b) => a[ 1 ] < b[ 1 ] )
      //     .reduce( (obj, item) => ({ ...obj, [item[ 0 ]]:item[ 1 ].trim() }), {} )
      //   const notOnPodiumPlaces = Object.keys( placesInfo ).filter( num => num >= 4 )
      //   const startDateAndTime = ``
      //     + `${twoDigitNum( date.getUTCHours() + (date.getTimezoneOffset() / -60 | 1) )}:${twoDigitNum( date.getMinutes() )}`
      //     + `  `
      //     + `${twoDigitNum( date.getDate() )}.${twoDigitNum( date.getMonth() + 1 )}.${date.getFullYear()}`

      //   jamChannel.send( "``` ```"
      //     + `\n**CactuJam ${number} rozpoczęty!**`
      //     + `\n**Temat**: ${subject.slice( 1, -1 )}`
      //     + `\n**Assety**: ${assets.slice( 1, -1 )}`
      //     + `\n**Termin startu i końca**: \`${startDateAndTime}\` -> \`${endTime}  ${endDate}\``
      //     + `\n**Kto może wziać udział**: Każdy, przy czym jeśli nie masz roli uczestnika musisz się po nią zgłosić`
      //     + (additional ? `\n**Dodatkowo**:\n    ${additional.slice( 1, -1 ).replace( /\n/g, `\n    ` )}` : ``)
      //     + `\n`
      //     + `\n**Nagrody**:`
      //     + `\n    **1#**: <@&478631184973430816> na co najmniej tydzień`
      //     + (1 in placesInfo ? ` + ${placesInfo[ 1 ]}` : '')
      //     + `\n    **2# 3#**: <@&504731377271439371> na około 3 dni`
      //     + (2 in placesInfo ? `\n       + 2# ${placesInfo[ 2 ]}` : '')
      //     + (3 in placesInfo ? `\n       + 3# ${placesInfo[ 3 ]}` : '')
      //     + notOnPodiumPlaces.reduce( (str, item) => `${str}\n    **${item}#** ${placesInfo[ item ]}`, `` )
      //     + `\n`
      //     + `\n    Podczas trwania oceniania każdy uczestnik dostanie rolę <@&504731377271439371>`
      //     + "\n\n``` ```"
      //   )

      //   jamChannel.setName( `cactujam-${number}` )
      // },
    }},

    winnerColor: { d:`Zmień kolor roli zwyciężcy CactuJamu`, r:`Zwycięzca CactuJam`, v( hexColor=/#[a-f0-9]{6}/ ) {
      $.message.guild.roles.cache.find( ({ name }) => name === `Zwycięzca CactuJam` ).setColor( hexColor )
    }},
    createMyNote: { d:`Stwórz notatkę w postaci przypiętej wiadomości na kanale #harmider`, v() {
      const m = $.message

      if (m.channel.id == `364471561803268097`) {
        m.channel.fetchPinnedMessages().then( messages => {
          let iDonthaveMyNote = true

          messages.forEach( m => m.author.id == m.author.id && (iDonthaveMyNote = false) )

          if (iDonthaveMyNote) m.pin()
          else throw `Posiadasz już swoją notatkę! \nMożesz do niej dodac odnośnik do innej wiadomości`
        } )
      } else throw `Na tym kanale nie można przypinać notatek!`
    }},
    lmgtfy: { d:`Let me google it for you`, v( text=/.+/ ) {
      $.send( `http://lmgtfy.com/?q=${encodeURIComponent( text )}` ).then( () => $.message.delete() )
    }},
    random: { d:`Losuj liczbę z zakresu *min-max*. Domyślny zakres to 1-2.`, v( min=/-?\d{1,10}/, max=/-?\d{1,10}/g ) {
      min = +min
      max = +max

      if (!max) max = 0
      if (min > max) [min, max] = [max, min]

      const rand = Math.floor( Math.random() * (max - min + 1) ) + min
      let message = `Z zakresu **${min}-${max}** wylosowano **${rand}**`

      if (min === 1 && max === 2) {
        message = `Zakres **1-2** interpretowany jest jako rzut monetą.\nWylosowana wartość to **${rand === 1 ? `orzeł` : `reszka`}**`
      }

      $.send( message )
    }},
    latex: { d:`Stwórz równanie w języku latex`, v( text=/.+/ ) {
      const m = $.message

      latex( text, true )
        .then( ({ canvas }) => {
          m.channel.send( `**${m.member} stworzył równanie!**\n> ||${text}||`, { files:[ canvas.toBuffer() ] } )
          m.delete()
        } )
        .catch( () => {
          $.send( `Oj, ${m.member} chyba nie umiesz robić równań bo coś jest z nim nie tak\n> ${latex}` )
          m.delete()
        } )
    }},
    mc: { d:`Sprawdź status serwera mc. Domyślne IP jest adresem aktywnego kaktusowego serwera (jeśli taki jest)`, v( addr=/.+/g ) {
      const m = $.message
      const address = addr || `cactu.csrv.pl`//`35.189.194.33:25565`

      fetch( `https://api.mcsrvstat.us/2/${encodeURIComponent( address )}` ).then( res => res.json() )
        .then( json => {
          console.log( json )
          if (!json.online) {
            let firstWord = addr ? `Podany` : `Domyślny`

            m.channel.send( `${firstWord} adres nie odpowiada. Albo jest niewłaściwy albo serwer jest wyłaczony` )

            return
          }

          const { icon, players, mods, version, motd } = json
          const modsCount = mods ? mods.names.length : 0
          const embed = {
            color: 0x18d818,
            title: `Informacja o serwerze`,
            description: `**Adres**: ${address}\n**MOTD**: ${motd.clean}`,
            fields: [
              { inline:true, name:`Aktywnych graczy`, value:`${players.online}/${players.max}` },
              { inline:true, name:`Wersja gry`, value:version },
              { inline:true, name:`Posiada modyfikacje?`, value:`${modsCount ? `Tak: ${modsCount}` : `Nie`}` },
            ]
          }

          if (players.online && players.list) {
            let list = players.list.slice( 0, 20 ).join( `, ` )

            if (players.list.length > 20) list += `, ...`

            embed.fields.push( { name:`Lista graczy`, value:list } )
          }

          if (icon) {
            embed.thumbnail = { url:`attachment://file.jpg`, }

            m.channel.send( { files:[ new Buffer( icon.replace( /data:image\/\w+;base64,/, `` ), `base64` ) ], embed } )
          } else m.channel.send( { embed } )
        } )
        .catch( () => m.channel.send( `Podałeś niepoprawny adres` ) )
    }},
    storm: { d:`Pokaż mapę burzową Polski`, v() {
      const link = `http://images.blitzortung.org/Images/image_b_pl.png?mapId=${Date.now()}`
      const header = `**${$.message.member} wezwał burzę!**`

      $.send( `${header}\n${link}` ).then( m => m.react( `🔄` ) )
      $.message.delete()
    }},
    rain: { d:`Pokaż mapę deszczową Europy`, v() {
      const format = { year:`numeric`, month:'2-digit', day: '2-digit', hour:`2-digit`, minute:`2-digit` }
      const minuteFormater = mm => `${Math.floor( +mm / 15 ) * 15}`.padStart( 2, 0 )

      const [ { value:DD },,{ value:MM },,{ value:YYYY },,{ value:hh },,{ value:mm } ] = new Intl.DateTimeFormat( `pl`, format )
        .formatToParts( Date.now() - 1000 * 60 * 4 )
      const [ { value:mm2 } ] = new Intl.DateTimeFormat( `pl`, { minute:`2-digit` } )
        .formatToParts( Date.now() - 1000 * 60 * 9 )

      let formatedMm = minuteFormater( mm )
      let formatedMm2 = minuteFormater( mm2 )

      const timeStrA = YYYY + MM + DD + hh + formatedMm
      const timeStrB = YYYY + MM + DD + hh + formatedMm2

      Promise.all( [
        loadImage( `https://en.sat24.com/image/background?region=eu&imagetype=rainTMC` ),
        loadImage( `https://en.sat24.com/image?type=rainTMC&region=eu&timestamp=${timeStrA}` ),
        loadImage( `https://en.sat24.com/image?type=rainTMC&region=eu&timestamp=${timeStrB}` ),
        //loadImage( `https://en.sat24.com/image?type=rainTMC&region=eu&timestamp=${timeStr}` ),
      ] ).then( ([ map, rainA, rainB ]) => {
        let which = `b`
        let rain = rainB
        let mm = formatedMm2

        if (rainA.width > 10) {
          rain = rainA
          mm = formatedMm
          which = `a`
        }

        ctxRain.drawImage( map, 0, 0, 845, 615 )
        ctxRain.drawImage( rain, 0, 0, 845, 575, 0, 0, 845, 575 )

        ctxRain.font = '30px "DejaVu Serif"'
        ctxRain.fillStyle = `#fff`
        ctxRain.fillText( `${+hh + 2}:${mm}`, 15, 30 )

        $.message.delete()
        $.message.channel.send( `**${$.message.member} wytańczył deszcz!**`, { files:[ canvasRain.toBuffer() ] } )
      } )
    }},
    // snow: { d:`Pokaż mapę śniegową`, v() {
    //   $.send( `http://zoz.cbk.waw.pl/images/stories/snow/mapa_duza.png?mapId=${Date.now()}` )//.then( m => m.react( `🔄` ) )
    //   $.message.delete()
    // }},
  },
}) // `

const temp = {
  "!": {
    roles: `Ekipa`,
    desc: `Przybornik moderatora`,

    chase( p={ userPing:/<@!?\d{18}>/, points:`/[1-9]/` }, d=`Deportuj użytkownika \n(przy 10 punktach delikwent jest banowany)` ) {
      const max = 10
      const time = 1000 * 60 * 60 * 1

      if (!(`!_chase_${userPing}` in $.vars))
        $.vars[ `!_chase_${userPing}` ] = {
          points: 0,
          lastChase: Date.now()
        }

      const user = $.vars[ `!_chase_${userPing}` ]

      if (  Date.now() - user.lastChase >= time ) {
        user.points -= Math.floor( (Date.now() - user.lastChase) / time )

        if ( user.points < 0 )
          user.points = 0;
      }

      user.points += points || 1
      user.lastChase = Date.now()

      if ( max - user.points >= 0 )
        m.channel.send( `${`🕳`.repeat( max - user.points )}${`<:cactu:465903558873710592>`.repeat( user.points )}` )
      else m.channel.send( `No to ban <:zeber:484783723468816394>` )
    },
    getUsers( p={ query:/a|active|u|unactive/ }, d=`Pobierz liste użytkowników według zapytania` ) {
      let count = 0
      let list = ""

      m.channel.guild.members.forEach( member => {
        if ( /a|active/.test( query ) && !member.roles.find( "name", "Fertyczny kaktus" ) ) return
        else if ( /u|unactive/.test( query ) && member.roles.find( "name", "Fertyczny kaktus" ) ) return

        list += member.displayName + "     "
        ++count
      } )

      m.channel.send( `Znaleziono **${count} użytkowników**:\n${list}` )
    }
  },
  leader: {
    desc: `Zestaw poleceń dla liderów kanałów`,
    roles: [ `Ekipa`, `Lider` ],

    add( r=`Ekipa`, p={ channelName:/\w{1,15}/ }, d=`Stwórz kanał niepowiązany` ) {
      const category = m.guild.channels.get( "577095435143872531" )

      m.guild.createChannel( channelName, { type:`text` } )
        .then( c => c.setParent( category ) )
        .then( c => c.lockPermissions() )
        .then( () => $.sendStatus( `Kanał stworzono poprawnie` ) )
        .catch( () => $.sendStatus( `Coś poszło nie tak, API nie odpowiada poprawnie ;/`, `error` ) )
    },
    remove( r=`Ekipa`, p={ channelHash:`/<#\d{18}>/` }, d=`Skasuj kanał niepowiązany` ) {
      /** @type {Discord.TextChannel} */
      const channel = channelHash ? m.guild.channels.get( channelHash.match( /\d+/ )[ 0 ] ) : m.channel

      if (!channel) throw `Taki kanał nie istnieje!`
      if (channel.parentID != `577095435143872531`) throw `Ten kanał nie jest kanałem niepowiązanym kolego ;-;`

      new Promise( async () => {
        await channel.setName( `❌-${channel.name}` )

        for (const perm of channel.permissionOverwrites.values()) {
          const member =  m.guild.members.get( perm.id )

          if (!member) continue

          const permissions = channel.permissionsFor( member )
          const FLAGS = permissions.constructor.FLAGS

          if (member && permissions.has( FLAGS.CREATE_INSTANT_INVITE ))
            await member.removeRole( m.guild.roles.find( r => r.name == `Lider` ) )

          await perm.delete()
        }

        channel.overwritePermissions( channel.guild.defaultRole, { VIEW_CHANNEL:false } ).then( () => $.sendStatus( `Kanał został zamknięty` ) )
      } )
    },
    toggleLeader( r=`Ekipa`, p={ userPingOrId:/\d{18}|<@!?\d{18}>/, channelHash:`/<#\d{18}>/` }, d=`Zmień lidera kanału` ) {
      /** @type {Discord.TextChannel} */
      const channel = channelHash ? m.guild.channels.get( channelHash.match( /\d+/ )[ 0 ] ) : m.channel
      const userId = userPingOrId.length > 18  ?  userPingOrId.match( /\d+/ )[ 0 ]  :  userPingOrId
      const user = m.guild.members.get( userId )
      const permissions = channel.permissionsFor( user )
      const role = m.guild.roles.find( r => r.name == `Lider` )
      /** @type {Discord.PermissionFlags} */
      const FLAGS = permissions.constructor.FLAGS

      if (!channel) throw `Taki kanał nie istnieje!`
      if (channel.parentID != `577095435143872531`) throw `Ten kanał nie jest kanałem niepowiązanym kolego ;-;`

      if (user.roles.has( role.id )) {
        if (permissions.has( FLAGS.CREATE_INSTANT_INVITE )) user.removeRole( role )
        else throw `Wskazany użytkownik jest liderem na innym kanale`
      } else user.addRole( role )

      new Promise( async () => {
        let leaderFounded = false

        for (const perm of channel.permissionOverwrites.values()) {
          if (perm.id == user.id) {
            leaderFounded = true
            continue
          }

          const member =  m.guild.members.get( perm.id )

          if (member && channel.permissionsFor( member ).has( FLAGS.CREATE_INSTANT_INVITE )) {
            await channel.overwritePermissions( member, { CREATE_INSTANT_INVITE:false } )
            await member.removeRole( role )
          }
        }
        const canInvite = leaderFounded && permissions.has( FLAGS.CREATE_INSTANT_INVITE ) || false

        await channel.overwritePermissions( user, { CREATE_INSTANT_INVITE:!canInvite } )

        if (!leaderFounded && !canInvite) await channel.overwritePermissions( user, { VIEW_CHANNEL:true } )

        $.sendStatus( `Lidera ustawiono pomyślnie` )
      } )
    },
    toggleHideUser( p={ userPingOrId:/\d{18}|<@!?\d{18}>/, channelHash:`/<#\d{18}>/` }, d="Zmień widoczność kanału dla wskazanego użytkownika" ) {
      /** @type {Discord.TextChannel} */
      const channel = channelHash ? m.guild.channels.get( channelHash.match( /\d+/ )[ 0 ] ) : m.channel
      const userId = userPingOrId.length > 18  ?  userPingOrId.match( /\d+/ )[ 0 ]  :  userPingOrId
      const user = m.guild.members.get( userId )
      const permissions = channel.permissionsFor( user )
      /** @type {Discord.PermissionFlags} */
      const FLAGS = permissions.constructor.FLAGS
      const channelModerator = m.member.roles.some( r => r.name == `Ekipa` ) || channel.permissionsFor( m.member ).has( FLAGS.CREATE_INSTANT_INVITE )
      const canView = permissions.has( FLAGS.VIEW_CHANNEL )

      if (!channelModerator) throw `Nie jesteś właścicielem tego kanału ;-;`
      if (channel.parentID != `577095435143872531`) throw `Ten kanał nie jest kanałem niepowiązanym kolego ;-;`
      if (user == m.member && channel.permissionsFor( m.member ).has( FLAGS.CREATE_INSTANT_INVITE )) throw `Nie mozesz zmienić widoczności dla siebie będąc liderem kanału ;-;`

      channel.overwritePermissions( user, { VIEW_CHANNEL:!canView } )
      $.sendStatus( `Zmieniono widoczność kanału dla wskazanego użytkownika` )
    },
    toggleHide( p={ channelHash:`/<#\d{18}>/` }, d=`Zmień prywatność kanału` ) {
      /** @type {Discord.TextChannel} */
      const channel = channelHash ? m.guild.channels.get( channelHash.match( /\d+/ )[ 0 ] ) : m.channel
      const permissions = channel.permissionsFor( m.guild.defaultRole )
      /** @type {Discord.PermissionFlags} */
      const FLAGS = permissions.constructor.FLAGS
      const channelModerator = m.member.roles.some( r => r.name == `Ekipa` ) || channel.permissionsFor( m.member ).has( FLAGS.CREATE_INSTANT_INVITE )
      const canView = permissions.has( FLAGS.VIEW_CHANNEL )

      if (!channelModerator) throw `Nie jesteś właścicielem tego kanału ;-;`
      if (channel.parentID != `577095435143872531`) throw `Ten kanał nie jest kanałem niepowiązanym kolego ;-;`

      channel.overwritePermissions( m.guild.defaultRole, { VIEW_CHANNEL:!canView } )
      $.sendStatus( `Widoczność kanału zmieniono poprawnie` )
    },
    redescribe( p={ newDescription:`!!!` }, d=`Zmień opis kanału` ) {
      /** @type {Discord.TextChannel} */
      const channel = m.channel
      const error = $.getUnrelatedPermsError( { message:m } )

      if (error != ``) throw error

      channel.setTopic( newDescription )
        .then( () => $.sendStatus( `Zmieniono opis pomyślnie` ) )
        .catch( () => $.sendStatus( `Nawet nie wiem co poszło nie tak`, `error` ))
    },
    rename( p={ newName:`!!!` }, d=`Zmień nazwę kanału` ) {
      /** @type {Discord.TextChannel} */
      const channel = m.channel
      const error = $.getUnrelatedPermsError( { message:m } )

      if (error != ``) throw error

      channel.setName( newName )
        .then( () => $.sendStatus( `Zmieniono nazwę pomyślnie` ) )
        .catch( err => $.sendStatus( `Nawet nie wiem co poszło nie tak`, `error` ))
    },
    pin( p={ messageId:/\d{18}/ }, d=`Przypnij/odepnij wiadomość na tym kanale` ) {
      /** @type {Discord.TextChannel} */
      const channel = m.channel
      const error = $.getUnrelatedPermsError( { message:m } )

      if (error != ``) throw error

      channel.fetchMessage( messageId )
        .then( msg => msg.pinned ? msg.unpin() : msg.pin() )
        .then( () => msg.pinned && $.sendStatus( `Odpięto pomyślnie` ) )
        .catch( () => $.sendStatus( `Nie ma tu wiadomości o takim ID`, `error` ))
    },
    delete( p={ messageIdOrNumber:/[1-2][0-9]$|[1-9]$|\d{18}$/ }, d=`Skasuj Okresloną wiadomość, lub kilka ostatnich jednocześnie` ) {
      /** @type {Discord.TextChannel} */
      const channel = m.channel
      const error = $.getUnrelatedPermsError( { message:m } )

      if (error != ``) throw error

      if (/^\d{1,2}$/.test( messageIdOrNumber )) $.evalCmd( `$ delete ${messageIdOrNumber}` )
      else channel.fetchMessage( messageIdOrNumber )
        .then( msg => {
          msg.delete()
          m.delete()
          $.sendStatus( `Usunięto pomyślnie` )
         } )
        .catch( () => $.sendStatus( `Nie ma tu wiadomości o takim ID`, `error` ))
    },
    tell( p={ text:`!!!` }, d=`Wyślij wiadomość poprzez bota na swoim włąsnym kanale` ) {
      const error = $.getUnrelatedPermsError( { message:m } )

      if (error != ``) throw error

      $.evalCmd( `tell ${text}`)
    }
  },
  pm: {
    desc: `Polecenia powiązane z wiadomościami prywatnymi`,

    clear( p={ range:/\d+/ }, d=`Wyczyść wiadomości bota w jego prywatnej korespondencji z Tobą \nW zasięg (od 1 do 30) wliczone są również Twoje wiadomości` ) {
      const limit = range < 1  ?  1  :  range > 30  ?  30  :  range

      m.author
        .createDM()
        .then( DM => {
          DM
          .fetchMessages( { limit } )
          .then( msgs => {
            for (let msg of msgs) if (msg[ 1 ].author.bot) msg[ 1 ].delete()
          } )
        } )
    },
    filters( d=`Spis filtrów wiadomości` ) {
      const { filters } = $.bot.guildsDbs.get( m.guild.id )

      m.author.send( ``
        + `**Wiadomość wygenerowana na życzenie użytkownika**\n`
        + `Wyrażenia regularne pełniące rolę filtrów na serwerze to: \n   *${filters.data.regExps.join( `*\n   *` )}*`
      )
    }
  },

  hashes( d=`Wyświetl użyteczne hashtagi` ) {
    m.channel.send( `**Kilka używanych hashtagów**:`
      + `\n> #zaniepokojenie`
      + `\n> #jeszczeraz`
      + `\n> #walczcie`
      + `\n> #dlaczego`
      + `\n> #otóżnie`
      + `\n> #ranfisz`
      + `\n> #smut`
      + `\n> #było`
      + `\n> #fbi`
    )
  },
}