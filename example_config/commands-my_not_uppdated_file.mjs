// // /
//
//
//     THAT FILE IS NOT TRANSLATED
//
//
// // /



/* *
 * References for evaluation variables */

import fs from 'fs'
import https from 'https'
import Discord from "discord.js"
import { GuildData } from "../index.js"

/** @type {Discord.Message} */
const m
const $ = {
  /** Discord.Message instance
   * @type {Discord.Message} */
  message: {},

  /** Guild data
   * @type {GuildData} */
  guildData: {},

  /** Scope for variables */
  vars: {},

  /** Send message with sign on start
   * @param {string} command guild command without prefix
   */
  evalCmd( command ) {},

  /** Send message with sign on start
   * @param {String} message
   * @param {"error"|"warn"|"ok"} status
   */
  sendStatus( message, status=`ok` ) {},
}


/* *
 * And commands below */

;( {
  myLang: {
    err_invalidCommand: `Polecenie które chcesz wykonać zwróciło błąd!`,
    err_badRole: `Nie masz do tego wymaganych uprawnień!`,
    err_badParam: `Wykryto niepoprawny parametr!`,
    err_noParam: `Nie podałeś wymaganych parametrów!`,
    err_noCommand: `Nie ma takiego polecenia!`,
    help: `Pomoc do konstrukcji podanego polecenia`,
    help_rest: `Dowolny ciąg znaków`,
    help_scope: `Podzestaw poleceń`,
    help_optional: `Parametr opcjonalny`,
    $_loadSucces: `Załadowano pomyślnie`,
    $_loadFail: `Niewłaściwe dane do załadowania`
  },

  /**
   * @param {Discord.ReactionEmoji} reaction
   * @param {Discord.User} user
   */
  async onMessageReactionAdd( reaction, user )  {
    if (user.id == `379234773408677888`) return

    const { message } = reaction

    if (message.author.id == `379234773408677888`) {
      if (/mapId=/.test( message.content )) {
        await message.clearReactions()
        await message.edit( `http://images.blitzortung.org/Images/image_b_pl.png?mapId=${Date.now()}` )
        await message.react( `🔄` )
      }
    }
  },
  /**
   * @param {Discord.GuildMember} member
   * @param {Discord.Invite} invite
   */
  async onGuildMemberAdd( member, invite ) {
    const { guild } = member
    const channel = guild.channels.get( guild.ownerID == member.id ? `470909446437208064` : `378975055696101408` ) // boty || kaktusy

    if (!invite) invite = (await guild.fetchInvites()).first()

    channel.send( `**Użytkownik ${member} właśnie dołączył do serwera**\n> Użyto zaproszenia z kodem \`${invite.code}\` wygenerowanym przez ${invite.inviter}` )

    if (member.user.bot) member.addRole( guild.roles.find( r => r.name == `Bot` ) )
  },

  structure: {
    $: {
      roles: `Przekaktus`,
      desc: `Boskie umiejętności`,

      tell( p={ channelHash:`/<#\d{18}>/`, attachments:`/1|true/`, text:`!!!` }, d=`Wyślij wiadomość poprzez bota` ) {
        const attachmentsUrls = []
        let channel = m.channel

        if (attachments) for ( const att of m.attachments.values() ) attachmentsUrls.push( att.url )
        if (channelHash) channel = m.guild.channels.find( channel => channel.id == channelHash.substring( 2, 20 ) )

        if (/^embeded /.test( text )) {
          try {
            channel.send( { files:attachmentsUrls, embed:eval( `(${text})` ) } )
          } catch {
            $.sendStatus( `Coś jest nie tak z embedem, którego próbujesz wysłać`, `error` )
          }
        } else channel.send( text, { files:attachmentsUrls } )

        m.delete()
      },
      edit( p={ channelHash:`/<#\d{18}>/`, botMessageId:/\d{18}/, newText:`!!!` }, d=`Wyślij wiadomość poprzez bota` ) {
        const channel = msg.channel

        if (channelHash) channel = $.bot.client.channels.find( channel => channel.id == channelHash.substring( 2, 20 ) )

        channel
          .fetchMessage( botMessageId )
          .then( msg => msg.edit( newText ) )
          .catch( () => channel.send( `🤦 Chyba podałeś mi złe ID` ) )

        m.delete()
      },
      delete( p={ amount:/\d+/ }, r=`Owner`, d=`Skasuj wiadomości` ) {
        let count = ++amount < 2  ?  2  :  (amount > 100  ?  100  :  amount)

        m.channel
          .bulkDelete( count )
          .then( deleted => {
            const countOfDeleted = deleted.size - 1
            let endOfMsg = `ostatnich wiadomości`

            if ( countOfDeleted == 1 ) endOfMsg = `ostatnią wiadomość`
            else if ( countOfDeleted < 5  ) endOfMsg = `ostatnie wiadomości`

            $.sendStatus( `Usunięto **${deleted.array().length - 1}** ${endOfMsg}` )

          } )
      },
      eval( p={ code:`!!!` }, r=`Owner`, d=`Wykonaj wprowadzony kod` ){
        const s = string => m.channel.send( string )

        try {
          eval( code )
        } catch {
          m.reply( `chyba nie potrafisz programować EH PANOWIE` )
        }
      },
    },
    "!": {
      roles: `Ekipa`,
      desc: `Przybornik moderatora`,

      anBreak( r=`Owner`, d=`przerwij ankietę` ) {
        if (!$.vars.an_active) return

        let response = `**Wyniki ankiety**\n${$.vars.an_question}\n`

        m.channel.fetchMessage( $.vars.an_id ).then( msg => {
          const reactions = msg.reactions

          for (const reaction of reactions ) response += `   ${reaction[0]} ${reaction[1].count-1} \n`

          $.vars.an_channel.send( response )
          $.vars.an_question = null
          $.vars.an_channel = null
          $.vars.an_active = false
          $.vars.an_id = null
        } )

      },
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
      an( p={ seconds:`/[0-9]+/`, responses:`/\[[^\[\]]+\]/`, question:`!!!` }, d=`Stwórz ankietę o nawet tygodniowym czasie na odpowiedź` ) {
        if ($.vars.an_active) return m.channel.send( `👹 O Ty robaczq! Poczekaj aż skończy się już utworzona ankieta!` )

        let minS = 10
        let maxS = 60 * 60 * 24 * 7

        if (!seconds) seconds = minS
        if (seconds > maxS) seconds = maxS
        if (!responses) responses = `[Tak|Nie]`

        responses = responses.slice( 1, -1 ).split( `|` )
        $.vars.an_channel = m.channel
        $.vars.an_question = question

        if (responses.length > 9) return $.vars.an_channel.send( `👹 Szatan Cię opętał!? 👹 Nie tak wiele odpowiedzi! 👹` )

        let nums = ['1⃣','2⃣','3⃣','4⃣','5⃣','6⃣','7⃣','8⃣','9⃣']
        let responsesString = ( () => {
          let res = ``

          for (const r of responses) res += `\n${nums[responses.indexOf( r )]} ${r}`

          return res
        } )()

        $.vars.an_channel.send( `❔ ${question}${responsesString}` ).then( msg => {
          $.vars.an_active = true
          $.vars.an_id = msg.id

          for ( let i = 0;  i < responses.length;  i++ )
            ( i => setTimeout( () => msg.react( nums[i] ), i * 400 ) )( i )

          setTimeout( () => $.evalCmd( `! anBreak` ), seconds * 1000 )
        } )

        m.delete()
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
    unRel: {
      desc: `Strefa nieskategoryzowana`,
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
        const permissions = channel.permissionsFor( m.member )

        if (!channel) throw `Taki kanał nie istnieje!`
        if (channel.parentID != `577095435143872531`) throw `Ten kanał nie jest kanałem niepowiązanym kolego ;-;`
        if (!permissions.has( permissions.constructor.FLAGS.CREATE_INSTANT_INVITE )) throw `Nie jesteś liderem tego kanału ;-;`

        channel.setTopic( newDescription )
          .then( () => $.sendStatus( `Zmieniono opis pomyślnie` ) )
          .catch( () => $.sendStatus( `Nawet nie wiem co poszło nie tak`, `error` ))
      },
      rename( p={ newName:`!!!` }, d=`Zmień nazwę kanału` ) {
        /** @type {Discord.TextChannel} */
        const channel = m.channel
        const permissions = channel.permissionsFor( m.member )

        if (!channel) throw `Taki kanał nie istnieje!`
        if (channel.parentID != `577095435143872531`) throw `Ten kanał nie jest kanałem niepowiązanym kolego ;-;`
        if (!permissions.has( permissions.constructor.FLAGS.CREATE_INSTANT_INVITE )) throw `Nie jesteś liderem tego kanału ;-;`

        channel.setName( newName )
          .then( () => $.sendStatus( `Zmieniono nazwę pomyślnie` ) )
          .catch( err => $.sendStatus( `Nawet nie wiem co poszło nie tak`, `error` ))
      },
      pin( p={ messageId:/\d{18}/ }, d=`Przypnij/odepnij wiadomość na tym kanale` ) {
        /** @type {Discord.TextChannel} */
        const channel = m.channel
        const permissions = channel.permissionsFor( m.member )

        if (!channel) throw `Taki kanał nie istnieje!`
        if (channel.parentID != `577095435143872531`) throw `Ten kanał nie jest kanałem niepowiązanym kolego ;-;`
        if (!permissions.has( permissions.constructor.FLAGS.CREATE_INSTANT_INVITE )) throw `Nie jesteś liderem tego kanału ;-;`

        channel.fetchMessage( messageId )
          .then( msg => msg.pinned ? msg.unpin() : msg.pin() )
          .then( () => msg.pinned && $.sendStatus( `Odpięto pomyślnie` ) )
          .catch( () => $.sendStatus( `Nie ma tu wiadomości o takim ID`, `error` ))
      },
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
    fun: {
      desc: `Polecenia bez sensownego zastosowania`,

      patologia( r=`Owner`, p={ countOfMessagesAbove:/-?\d+/, pings:`???` }, d=`Uznaj wiadomości wyżej za patologię` ) {
        if (m.member.id == `389814624662454285`) return

        const emoji = m.guild.emojis.get( `584036528939073541` )
        const ids = (pings || ``).match( /\d{18}/ ) || []

        countOfMessagesAbove = +countOfMessagesAbove

        if (countOfMessagesAbove > 15) countOfMessagesAbove = 15
        else if (countOfMessagesAbove < -15) countOfMessagesAbove = -15
        else if (countOfMessagesAbove == 0) return
        if (!emoji) return

        m.channel.fetchMessages( { limit:Math.abs( countOfMessagesAbove ) } ).then( messages => messages.forEach( msg => {
          if (countOfMessagesAbove > 0) {
            if (ids.length == 0 || ids.includes( msg.author.id )) msg.react( emoji )
          } else {
            msg.reactions.filter( r => r.emoji == emoji ).forEach( r => r.remove( `379234773408677888` ) )
          }
        } ) )
      },
      spoiler( p={ text:`!!!` }, d=`Zrób spoilerową szachownicę` ) {
        let msg = ``

        for (const char of text.split( `` )) msg += `||${char}||`

        m.channel.send( `${m.member.displayName} utworzył szachownicę: \n${msg}` )
        m.delete()
      },
      secret( p={ text:`!!!` }, d=`Wyślij zaszyfrowaną wiadomość` ) {
        m.channel.send( `${m.member.displayName} napisał szyfr: ${text.replace( /a|e|i|o|u|y|ą|ę|ó/gi, `` )}` )
        m.delete()
      },
      kitku( d=`Ersaniec` ) {
        m.channel.send( `<:ersan:485916149612150786>` )
        m.delete()
      },
      stone( d=`Rzuć kamieniem` ) {
        m.channel.fetchMessages( { limit:3 } ).then( msgs => {
          let nickname = ``
          let chance = Math.random()

          msgs = Array.from( msgs.values() )

          if (chance >= .85) nickname = msgs[ 2 ].member.displayName
          else if (chance >= .6) nickname = msgs[ 1 ].member.displayName
          else if (chance >= .4) nickname = msgs[ 0 ].member.displayName

          if (chance >= .95 || nickname == m.member.displayName) nickname = `**xD z typa** bo sam od siebie`

          const addon = nickname ? `${nickname} oberwał` : `Pudło 🤦`

          m.channel.send( `*${m.member.displayName} rzuca kamieniem*    (╯°□°）╯<:stone:539048004011687939> \n${addon}` )
          m.delete()
        } )
      },
      ban( r=`Owner`, p={ userPing:'/<@!?\d{18}>/' }, d=`Zbanuj go kotem` ) {
        try {
          console.log( fs.readdirSync( `.` ) )
          m.channel.send( `test`, { files:[`./CactuJam-5.zip`] } )
          // https.get( m.author.avatarURL, res => {
          //   const encoder = new $.GIFEncoder( 854, 480 )

          //   console.log( `typeof $.GIFEncoder` )

          //   const gif = encoder.createWriteStream( { repeat:-1, delay:100, quality:10 } )

          //   res.pipe( gif ).on( `finish`, () => {
          //     console.log( gif.end() )
          //     console.log( gif )
          //   } )
          // } )
        } catch (err) {
          console.log( err )
        }
        // m.attachments
      },
      oko( d=`Oko patrzy` ) {
        m.channel.send( `<:oko:447037988715757569>` )
          .then( async msg => {
            msg.edit( `<:oko:447037988715757569>` )
            await new Promise( res => setTimeout( res, 1500 ) )
            msg.edit( `🧿` )
            await new Promise( res => setTimeout( res, 2000 ) )
            msg.delete()
          } )
        m.delete()
      }
    },
    dialog: {
      desc: `Wyślij wstawkę, która może pasować do rozmowy`,

      bylo( d=`A było było` ) {
        m.channel.send( `https://youtu.be/odRjw1i9s3Q` )
        m.delete()
      },
      teraz( d=`TERAZ TERAZ TERAZ` ) {
        m.channel.send( { files:[ `./files/teraz.mp4`] } ).then( () => m.delete() )
      },
      nobody( d=`A któż by się spodziewał` ) {
        m.channel.send( `https://www.youtube.com/watch?v=SxJASsVRRpQ` )
        m.delete()
      },
      fbi( d=`Open up` ) {
        m.channel.send( { files:[ `./files/fbi_open_up.mp3`] } )
        m.delete()
      },
      wegothim( d=`We got him` ) {
        m.channel.send( `https://www.youtube.com/watch?v=EIph0BJNrxo` )
        m.delete()
      },
      umrzyj( d=`Zabij się` ) {
        m.channel.send( `https://open.spotify.com/track/4G1GhiYTkfgsmMv1xlL6jO?si=kubr1SOlTxGwPQN1X0MG_g` )
        m.delete()
      },
      hehehihi( d=`haha` ) {
        m.channel.send( { files:[ `./files/hahahohohihihehe.mp3`] } )
        m.delete()
      },
      kiss( d=`Pocałuj mnie` ) {
        m.channel.send( { files:[ `./files/kiss_me.mp3`] } )
        m.delete()
      },
      hell( d=`Już niebawem` ) {
        m.channel.send( { files:[ `./files/prawdziwy_hell.mp3`] } )
        m.delete()
      },
      smut( d=`Przykra sprawa` ) {
        m.channel.send( { files:[ `./files/przykra_sprawa.mp3`] } )
        m.delete()
      },
      kretyni( d=`xD w was` ) {
        m.channel.send( { files:[ `./files/kretyni.mp3`] } )
        m.delete()
      },
      aleBymWam( d=`... wszsytkim na tym czacie` ) {
        m.channel.send( { files:[ `./files/ale_bym_wam_na_tym_czacie.mp3`] } )
        m.delete()
      },
      kupa( d=`Kał` ) {
        m.channel.send( { files:[ `./files/odchody.mp3`] } )
        m.delete()
      },
      wnerw( d=`Ta sytuacja mnie denerwuje` ) {
        m.channel.send( { files:[ `./files/triggered.mp3`] } )
        m.delete()
      },
      dlaczego( d=`Dlaczego to zrobiłeś?` ) {
        m.channel.send( { files:[ `./files/dlaczego.mp3`] } )
        m.delete()
      },
      jeszczeRaz( d=`Możesz jeszcze raz to zrobić?` ) {
        m.channel.send( { files:[ `./files/jeszcze_raz.mp3`] } )
        m.delete()
      },
      otozNie( d=`Otóż nie` ) {
        m.channel.send( { files:[ `./files/1z10_nie.mp3`] } )
        m.delete()
      }
    },
    jam: {
      desc: `Zestaw poleceń zarządzajacych Cactujamem`,

      open( r=`Owner`, d=`Otwórz zapisy na zawody` ) {
        const jamChannel = m.guild.channels.get( `478209069954367498` )

        jamChannel.send( "``` ```"
          + `\n**Można składać podania o uczestnictwo w zawodach CactuJam!**`
          + `\n`
          + `\nKażdy zainteresowany (czyli taki ktoś, kto chciałby wziąć udział a nie jest kimś, kto weźmie udział na 100% -`
          + ` np. gdy uczestnictwo zależy od terminu) możne zostawić kaktusową reakcję.`
          + `\nUstalenia rozpoczną się po zebraniu bliżej nieokreślonej liczby chętnych`
          + "\n\n``` ```"
        ).then( m => m.react( m.guild.emojis.find( `name`, `cactu` ) ) )

        jamChannel.setName( `cactujam-zapisy` )
      },
      info( r=`Owner`, d=`Wygeneruj wiadomość inicjującą zawody. Dodatki do zajmowanego miejsca powinna poprzedzań cyfra z dwukropiem (np. "1: coś")`, p={
        number: /\d+/,
        subject: /"[^"]+"/,
        assets: /"[^"]+"/,
        endTime: /\d\d:\d\d/,
        endDate: /\d\d\.\d\d\.\d\d\d\d/,
        additional: `/"[^0-9][^"]+"/`,
        infoForPlaces: `/\d+: *\S[\s\S]*/`
      } ) {
        const date = new Date
        const jamChannel = m.guild.channels.get( `478209069954367498` )
        const twoDigitNum = num => `${num}`.length == 2 ? num : `0${num}`
        const placesInfo = !infoForPlaces ? [] : infoForPlaces
          .match( /\d+: *[\s\S]+?(?= *\d+:|$)/g )
          .map( match => match.split( /: */ ) )
          .sort( (a, b) => a[ 1 ] < b[ 1 ] )
          .reduce( (obj, item) => ({ ...obj, [item[ 0 ]]:item[ 1 ].trim() }), {} )
        const notOnPodiumPlaces = Object.keys( placesInfo ).filter( num => num >= 4 )
        const startDateAndTime = ``
          + `${twoDigitNum( date.getUTCHours() + (date.getTimezoneOffset() / -60 | 1) )}:${twoDigitNum( date.getMinutes() )}`
          + `  `
          + `${twoDigitNum( date.getDate() )}.${twoDigitNum( date.getMonth() + 1 )}.${date.getFullYear()}`

        jamChannel.send( "``` ```"
          + `\n**CactuJam ${number} rozpoczęty!**`
          + `\n**Temat**: ${subject.slice( 1, -1 )}`
          + `\n**Assety**: ${assets.slice( 1, -1 )}`
          + `\n**Termin startu i końca**: \`${startDateAndTime}\` -> \`${endTime}  ${endDate}\``
          + `\n**Kto może wziać udział**: Każdy, przy czym jeśli nie masz roli uczestnika musisz się po nią zgłosić`
          + (additional ? `\n**Dodatkowo**:\n    ${additional.slice( 1, -1 ).replace( /\n/g, `\n    ` )}` : ``)
          + `\n`
          + `\n**Nagrody**:`
          + `\n    **1#**: <@&478631184973430816> na co najmniej tydzień`
          + (1 in placesInfo ? ` + ${placesInfo[ 1 ]}` : '')
          + `\n    **2# 3#**: <@&504731377271439371> na około 3 dni`
          + (2 in placesInfo ? `\n       + 2# ${placesInfo[ 2 ]}` : '')
          + (3 in placesInfo ? `\n       + 3# ${placesInfo[ 3 ]}` : '')
          + notOnPodiumPlaces.reduce( (str, item) => `${str}\n    **${item}#** ${placesInfo[ item ]}`, `` )
          + `\n`
          + `\n    Podczas trwania oceniania każdy uczestnik dostanie rolę <@&504731377271439371>`
          + "\n\n``` ```"
        )

        jamChannel.setName( `cactujam-${number}` )
      },
      dateChoosing( p={ openInfoMsgId:/\d{18}/, howMany:`/[1-9]$/` }, r=`Owner`, d=`Wygeneruj prostą ankietę na kilka następnych tygodni i rozpocznij ustalenia tematów ogólnych` ) {
        if (!howMany) howMany = 4

        const jamChannel = m.guild.channels.get( `478209069954367498` )
        const nums = ['1⃣','2⃣','3⃣','4⃣','5⃣','6⃣','7⃣','8⃣','9⃣']
        const date = new Date
        const now = Date.now()
        const day = 1000 * 60 * 60 * 24
        const daysToFriday = 5 - date.getDay()
        const fridays = Array( howMany ).fill( 1 ).map( (_, i) => new Date( now + daysToFriday + day * (i + 1) * 7 ) )
        const twoDigitNum = num => `${num}`.length == 2 ? num : `0${num}`
        const getDateTime = date => `${twoDigitNum( date.getDate() )}.${twoDigitNum( date.getMonth() + 1 )}.${date.getFullYear()}`

        jamChannel.fetchMessage( openInfoMsgId ).then( msg => {
          for (const reaction of msg.reactions.values() ) reaction.fetchUsers()
            .then( users => users.map( user => m.guild.member( user ) ) )
            .then( members => members.forEach( member => member.addRole( `552076455731789839` ) ) )
        } )

        jamChannel.send( ``
          + `**Przyszedł czas na ustalenia**`
          + `\n Jeśli ktoś ma propozycję odnośnie odgórnego tematu (który będzie obok losowanych w dzień startu),`
          + ` lub jakikolwiek inny pomysł odnośnie jamu - może to zaproponować teraz`
          + `\n`
          + `\n**Przykładowe daty startu**:`
          + fridays.reduce( (str, item, i) => `${str}\n    **${i + 1}#** ${getDateTime( item )}`, `` )
        ).then( async m => {
          for (let i = 0; i < howMany; i++) await m.react( nums[ i ] )
        } )

        jamChannel.setName( `cactujam-ustalenia` )
      },
      vote( p={ nickOrNumber:/[\d\w]+/, subjectPoints:/[0-2]+/, gameplayPoints:/[0-4]+/, audiovisualPoints:/[0-4]+/ }, d=`Oddaj głos na uczestnika CactuJamu` ) {
        const voteMessageId = $.vars.jam_vote_messageId
        const voteChannelId = $.vars.jam_vote_channelId
        const votersIds = $.vars.jam_vote_votersIds
        const nickname = m.member.displayName.replace( / /g, `_` )

        if (!voteMessageId || !voteChannelId) throw `Nie została ustawiona wiadomość, w której zbierane są głosy!`

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

        let newContent = '```py\n @ Punktacja'
        let voterIndices = {}
        const voteChannel = m.guild.channels.get( voteChannelId )
        const updateContent = (voterStr, subject, gameplay, audiovisual) => newContent += ''
          + `\n    ${voterStr.padEnd( 15, ' ' )}`
          + ` ${subject}`.padStart( 4, ' ' )
          + ` ${gameplay}`.padStart( 4, ' ' )
          + ` ${audiovisual}`.padStart( 4, ' ' )

        voteChannel.fetchMessage( voteMessageId ).then( msg => {
          const usersVotes = msg.content.match( /((?<=\n\n).+?(?=\n +-))+/gs )
          const labels = []
          const subjectPointsMultiplier = 4
          const gameplayPointsMultiplier = 2
          const audiovisualPointsMultiplier = 1
          const voter = nickname
          let voterLastNick = voter
          let voted = false

          if (m.member.id in votersIds) {
            voterLastNick = votersIds[ m.member.id ].nick
            voterIndices = votersIds[ m.member.id ].indices
          }

          usersVotes.forEach( scopes => {
            const lines = scopes.split( '\n' )

            const { index, nick } = lines.shift().match( /\[(?<index>\d+)] # (?<nick>.+)/ ).groups
            const votes = {
              ' calctulated': { subject:0, gameplay:0, audiovisual:0 },
              ' total': { subject:0, gameplay:0, audiovisual:0 }
            }

            const t = votes[ ' total' ]
            const voteIsForHim = nickOrNumber == index || nickOrNumber == nick
            const voterIndex = voterIndices[ index ]
            let voterFounded = false

            newContent += `\n\n[${index}] # ${nick}`

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

            newContent += `\n    ${' -'.repeat( 7 )}`

            if (lines != 0 || (!voterFounded && voteIsForHim)) {
              updateContent( ' ', t.subject, t.gameplay, t.audiovisual )
              newContent += `   =>   ${votes[ ' calctulated' ]}`
            }

            labels[ index ] = votes
            labels[ nick ] = votes
          } )

          newContent += '```'

          if (voted) {
            const link = `https://discordapp.com/channels/${voteChannel.guild.id}/${voteChannelId}/${voteMessageId}`

            $.sendStatus( `Głos oddany prawidłowo (${nickname} -> ${subjectPoints} ${gameplayPoints} ${audiovisualPoints})\n${link}` )
          }
          else throw `Nie znaleziono uczestnika którego wskazałeś`

          msg.edit( newContent )
        } ).then( () => votersIds[ m.member.id ] = {
          nick: nickname,
          indices: voterIndices
        } )
      },
      startVoting( r=`Owner`, p={ participants:`!!!` }, d=`Ustaw wiadomość startową dla gosowania` ) {
        let content = '\n```py\n @  Punktacja'

        participants.split( ' ' ).forEach( (participant, i) => content += `\n\n[${i + 1}] # ${participant}\n    ${' -'.repeat( 7 )}` )

        m.channel.send( content + '```' ).then( msg => {
          $.vars.jam_vote_messageId = msg.id
          $.vars.jam_vote_channelId = msg.channel.id
          $.vars.jam_vote_votersIds = {}
        } )
      },
      setVotingMsg( r=`Owner`, p={ messageId:/\d{18}/, channelId:`/\d{18}/` }, d=`Ustaw wiadomość bota, do której wpisywane są głosy` ) {
        $.vars.jam_vote_messageId = messageId
        $.vars.jam_vote_channelId = channelId || msg.channel.id
        $.vars.jam_vote_votersIds = {}
      }
    },

    winnerColor( p={ hexColor:/#[a-f0-9]{6}/ }, r=`Zwycięzca CactuJam` ) {
      m.guild.roles.find( `name`, `Zwycięzca CactuJam` ).setColor( hexColor )
    },
    tell( r=`Weteran`, p={ text:`!!!` }, d=`Wyślij wiadomość poprzez bota` ) {
      if ( /@everyone|@here/.test( text ) ) {
        // let spamer = message.guild.roles.find( `name`, `Spamer` )
        // let weteran = message.guild.roles.find( `name`, `Weteran` )
        // let user = message.member

        // if (!user.roles.has( spamer.id ))
        //   user.addRole( spamer )

        // user.removeRole( weteran )
        // text = `${message.author.username} próbował wywołać pingoburzę. Koniec końców obsypał go ~~de~~grad`
        text = `Otóż nie tym razem`
      }

      m.channel.send( text )
      m.delete()
    },
    createMyNote( d=`Stwórz swoją notatkę - przypiętą wiadomość` ) {
      if ( m.channel.id == `364471561803268097`) {
        m.channel.fetchPinnedMessages().then( messages => {
          let iDonthaveMyNote = true

          messages.forEach( m => m.author.id == m.author.id && (iDonthaveMyNote = false) )

          if ( iDonthaveMyNote ) m.pin()
          else {
            $.sendStatus( `Posiadasz już swoją notatkę! \nMożesz do niej dodac odnośnik do innej wiadomości`, `error` )
            m.delete()
          }
        } )
      }
      else {
        $.sendStatus( `Na tym kanale nie można przypinać notatek!`, `error` )
        msg.delete()
      }
    },
    an( p={ seconds:`/[0-9]+/`, responses:`/\[[^\[\]]+\]/`, question:`!!!` }, d=`Stwórz ankietę \nOdpowiedzi tworzymy wedle wzoru: [1|2|...|9]` ) {
      let minS = 10
      let maxS = 60 * 10

      if (!seconds) seconds = minS
      if (seconds > maxS) seconds = maxS

      $.evalCmd( `! an ${seconds} ${responses || ""} ${question}`)
    },
    random( p={ range:`/\d+-\d+/` }, d=`Losuj liczbę z zakresu *min-max*` ) {
      let min = 1
      let max = 10

      if (range) {
        range = range.split( `-` )

        min = +range[ 0 ]
        max = +range[ 1 ]

        if (min > max) {
          min = +range[ 1 ]
          max = +range[ 0 ]
        }
      }

      m.channel.send( `Z zakresu **${min}-${max}** wylosowano **${Math.floor( Math.random() * (max - min + 1) ) + min}**` )
    },
    hashes( d=`Wyświetl użyteczne hashtagi` ) {
      m.channel.send( `**Kilka używanych hashtagów**:`
        + `\n> #zaniepokojenie`
        + `\n> #jeszczeraz`
        + `\n> #dlaczego`
        + `\n> #otóżnie`
        + `\n> #ranfisz`
        + `\n> #było`
        + `\n> #smut`
        + `\n> #fbi`
      )
    },
    storm( d=`Pokaż mapę burzową` ) {
      m.channel.send( `http://images.blitzortung.org/Images/image_b_pl.png?mapId=${Date.now()}` ).then( m => m.react( `🔄` ) )
    },
    snow( d=`Pokaż mapę śniegową` ) {
      m.channel.send( `http://zoz.cbk.waw.pl/images/stories/snow/mapa_duza.png?mapId=${Date.now()}` )
    }
  }
} )