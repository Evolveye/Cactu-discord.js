const { createCanvas, loadImage } = await import( `canvas` )

/** @typedef {import("discord.js").Message} DCMessage */
/** @typedef {import("discord.js").Guild} DCGuild */

/** @type {import("../../index.js")} */
const { DCModule, Scope, DCExecutor, DCCmdExecutor, DCFilter } = await import( `@lib/index.js` )
// const vulgarismReg = /([^\n ]*(?:c[i!]p[a@o0y]|(?<![^ ])c?h[vuo0ó][jy]|(?:[kg][vuo0ó]|q)t[a@][$sz]|(?:k[vuó]|q)wa|deb[i!]l|(?:[kg][vuo0ó]|q)re?[wv]|([wv]y?)?p[i!]erd[o0a@](?:l|ł[aey])|spierd|jprdl|jeb|r[vuo0ó]ch[a@]n[i!]e|p[i!]zd)[^\n ]*)/gi
const vulgarismReg = /([^\n ]*(c[i!]p[a@o0y]|(?<![^ ])c?h[vuo0ó][jy]|(?:[kg][vuo0ó]|q)t[a@][$sz]|(?:k[vuó]|q)wa|(?:[kg][vuo0ó]|q)re?[wv]|([wv]y?)?p[i!]erd[o0a@](?:l|ł[aey])|spierd|jprdl|jeb[ua@]?|r[vuo0ó]ch[a@]n[i!]e|p[i!]zd)[^\n ]*)/gi
const cactuGuildId = `315215466215899146`
const adminChannelId = `650009788280733712` // KaktusGodowy

const ThreadChanelType = 11

const dcModule = new DCModule({
  prefix: `cc! `,

  events: {
    guildMemberRemove: async member => {
      if (!member.guild || member.guild.id !== cactuGuildId) return

      console.log( `guildMemberRemove`, {
        isGuild: !!member.guild,
        guildId: member.guild?.id,
        displayName: member.displayName,
        nickname: member.nickname,
        username: member.user?.username,
        userDisplayName: member.user?.displayName,
        memberId: member.id,
        userId: member.user?.id,
        guildName: member.guild?.name,
      } )

      const guild = await member.client.guilds.fetch( cactuGuildId )
      const channel = await guild.channels.fetch( adminChannelId )
        .catch( err => ({ err }) )

      if (channel.err) console.log({ err })
      else channel.send( `<:minus:749609815701192735> Serwer opuścił użytkownik **${member.displayName ?? member.nickname}** (id=${member.id})` )
    },

    guildMemberAdd: async member => {
      if (!member.guild || member.guild.id !== cactuGuildId) return

      console.log( `guildMemberAdd`, {
        isGuild: !!member.guild,
        guildId: member.guild?.id,
        displayName: member.displayName,
        nickname: member.nickname,
        username: member.user?.username,
        userDisplayName: member.user?.displayName,
        memberId: member.id,
        userId: member.user?.id,
        guildName: member.guild?.name,
      } )

      const guild = await member.client.guilds.fetch( cactuGuildId )
      const channel = await guild.channels.fetch( adminChannelId )
        .catch( err => ({ err }) )

      if (channel.err) console.log({ err })
      else channel.send( `<:plus:749609803482923098> Na serwer dołączył użytkownik **${member.displayName ?? member.nickname}** (id=${member.id})` )
    },
  },

  translation: {
    "err.error": `Błąd`,
    "err.invalidCommand": `Podczas wykonywania polecenia powstał problem uniemożliwiajacy dokończenie zadania. Spróbuj ponownie później`,
    "help.title": `⚙️ Pomoc do poleceń`,
    "help.optionalParam": `Znak **?** oznacza parametr opcjonalny/nieobowiązkowy`,
    "help.restParam": `Wielokropek **...** oznacza dowolny ciag znaków`,
    "help.scopes": `Zbiory poleceń`,
    "help.commands": `Polecenia`,
    "help.nothing": `Tutaj nie ma żadnych poleceń`,
  },

  interactions: {
    random: interaction => {
      if (!(interaction.isButton())) return

      const content = interaction.message.content
      const match = content.match( /(\d+).*?(\d+)/ )

      const [ min, max ] = match
        ? [ match[ 1 ], match[ 2 ] ].map( Number )
        : [ 0, 1 ]

      const rand = Math.floor( Math.random() * (max - min + 1) ) + min

      const messageAddon = match
        ? `Z zakresu <**\`${min}\`**; **\`${max}\`**> wylosowano **${rand}**`
        : `Wylosowana wartość to **${rand === 1 ? `orzeł` : `reszka`}**`

      const message = content + `\n` + messageAddon

      interaction.update({ content:message, components:content.match( /\n/g )?.length > 9 ? [] : undefined })

      // interaction.showModal({
      //   title: `Test`,
      //   components: [
      //     {
      //       type: 1,
      //       components: [
      //         {
      //           type: 4,
      //           label: `Reroll`,
      //           style: 1,
      //           custom_id: `random`,
      //         },
      //       ],
      //     },
      //   ],
      //   customId: `random-modal`,
      // })
    },
  },

  filters: [
    new DCFilter( /^#ranfisz$/, async(txt, $) => {
      await $.channel.bulkDelete( 2 )

      if (Math.random() > 0.95) {
        $.send( `Ranfisz ||a może Blacky|| mówi **stop** takim wiadomościom!` )
      } else {
        $.send( `Ranfisz mówi **stop** takim wiadomościom!` )
      }
    } ),
    new DCFilter( /#było/, (txt, $) => {
      $.send( `https://www.youtube.com/watch?v=odRjw1i9s3Q` )
    } ),
    new DCFilter( /. +>{5,} +./, (txt, $) => {
      $.deleteMsg()
      $.send( `${txt}\nAle jak kto woli ¯\\_(ツ)_/¯` )
    } ),
    new DCFilter( /teraz +teraz +teraz/, async(txt, $) => {
      $.send({ files:[ `./files/teraz.mp4` ] })
    } ),
    new DCFilter( /ILE\?/, async(txt, $) => {
      $.send({ files:[ `./files/ile.mp4` ] })
    } ),
    new DCFilter( /<\w+>/, async(txt, $, f$) => {
      if (!$.msg) return

      const { content, member, author, channel } = $.msg
      let replaced = false

      if (author.bot) return

      const message = content.replace( /<\w+>/g, match => {
        const emojiName = match.slice( 1, -1 )

        let emoji = null
        for (const guild of $.bot.client.guilds.cache.values()) {
          const matchedEmocji = guild.emojis.cache.find( ({ name }) => name == emojiName )

          if (matchedEmocji) {
            emoji = matchedEmocji
            break
          }
        }

        if (emoji) replaced = true

        return emoji || match
      } )

      if (!replaced) {
        f$.filterMatched = false
        return
      }

      const webhook = await $.getWebHook( channel )

      if (!webhook) return console.log( `No webhook on ${channel?.name}` )

      $.msg.delete()
      webhook.send({
        content: message,
        username: member.displayName,
        avatarURL: author.displayAvatarURL(),
        threadId: channel.type === ThreadChanelType ? channel.id : undefined,
      })
    } ),
    // new DCFilter( /264419108332896256/, async(txt, $, f$) => { // @Ranfisz ?
    //   if (txt.endsWith( `?` )) $.send( `#żonanierodzi` )
    //   else f$.filterMatched = false
    // } ),
    new DCFilter( /emotional damage/, async(txt, $) => {
      $.send( `https://www.youtube.com/watch?v=Lg4WETxq7nc` )
    } ),
    new DCFilter( /cecemc|ceceemce/, async(txt, $) => {
      $.runCmd( `mc` )
    } ),
    new DCFilter( /#zaniepokojenie/, async(txt, $) => {
      $.send( `#zaniepokojeniemocnobardzo` )
    } ),
    new DCFilter( /na prawd[eę]/i, async(txt, $) => {
      $.send( `Naprawdę* <:zeber:484783723468816394>` )
    } ),
    new DCFilter( /./i, async(txt, $, f$) => {
      if ($.channel.name !== `znaleziska`) {
        f$.filterMatched = false
        return
      }

      if ($.msg.attachments.size > 0 || /https?:\/\/\w+\.\w{2,}/.test( txt )) {
        f$.filterMatched = false
        return
      }

      $.deleteMsg()
    } ),

    new DCFilter( vulgarismReg, async(txt, $, f$) => {
      if ($.channel.name == `weterani`) return (f$.filterMatched = false)

      let vulgarism = false
      let minIndex = Infinity
      let maxIndex = -Infinity
      let vulgarismsLength = 0
      const matchedVulgs = []

      const content = $.msg.content.replace( vulgarismReg, (word, matchedWord, matchedVulg, i) => {
        if (Math.ceil( matchedWord.length / 2 ) >= matchedVulg.length) return matchedWord
        if (/^https:\/\/|recip|korwin|kotaszybkie|kurewkurnik|hojnie|hojny|hojno[sś][cć]|chojnic|wkuwa/i.test( matchedWord )) return matchedWord

        vulgarism = true
        vulgarismsLength += matchedVulg.length

        matchedVulgs.push( matchedWord )

        if (i < minIndex) minIndex = i
        else if (i > maxIndex) maxIndex = i

        return `**${matchedWord}**`
      } )

      if (!vulgarism) return (f$.filterMatched = false)

      if ($.msg.member.id === `1231340364472778792`) { // Murshtin bot
        return $.msg.reply( `Uspokój się bo ci walnę <a:ban:678743168275054601>` )
      }

      setTimeout( async() => {
        /** @type {DCGuild} */ const guild = $.channel.guild
        const notNiceMsg = $.channel.messages.cache.get( $.msg.id )

        if (!notNiceMsg?.member) return

        let slicedContent = content

        if (content.length > 1000) {
          let startIndexWithPadding = minIndex - 25
          const endIndexWithPadding = maxIndex + 25

          if (startIndexWithPadding < 0) startIndexWithPadding = 0
          if (endIndexWithPadding > content.length) startIndexWithPadding = content.length

          slicedContent = content.slice( startIndexWithPadding, endIndexWithPadding )

          if (slicedContent.length > 1000) slicedContent = slicedContent.slice( 0, 1000 )
        }

        // console.log({ vulgarismsLength, contentLength:$.msg.content.length, matchedVulgs })

        if (vulgarismsLength >= $.msg.content.length) {
          notNiceMsg.channel.send( `Pałka się przegła <:ferdek:1307706718674878486>` )
          notNiceMsg.member.timeout( 1000 * 50 ).catch( e => console.error( `Vulg filter error:`, e.message ) )
        }

        // const warnText = `Przyzywam was strażnicy pokoju: ${inkwizycja}`
        const embed = {
          title: `⚠️  Filtr moderacyjny`,
          color: 0xff0000,
          fields: [
            { name:`Cytat`, value:`> ${slicedContent}` },
            { name:`Długość treści`, value:`${$.msg.content.length}`, inline:true },
            { name:`Długość wulgów`, value:`${vulgarismsLength}`, inline:true },
            { name:`Liczba wulgow`, value:`${matchedVulgs.length}`, inline:true },
            // { name:`Autor`, value:`${notNiceMsg.member}`, inline:true },
            {
              name: `Umiejscowienie wiadomości`,
              value: ``
                + `[${notNiceMsg.guild.name}](https://discord.com/channels/${notNiceMsg.guild.id}) `
                + `❯ [${notNiceMsg.channel.name.charAt( 0 ).toUpperCase()}${notNiceMsg.channel.name.slice( 1 )}](https://discord.com/channels/${notNiceMsg.guild.id}/${notNiceMsg.channel.id}) `
                + `❯ [Wiadomość ${notNiceMsg.member.displayName}](https://discord.com/channels/${notNiceMsg.guild.id}/${notNiceMsg.channel.id}/${notNiceMsg.id}) `,
              inline: true,
            },
          ],
        }

        const role = await guild.roles.fetch( `586511781325963284` )
        role.members.forEach( member => member.createDM()
          .then( dm => dm
            .send({ embeds:[ embed ] })
            .catch( () => console.log( `Cannot send report to the user ${member.displayName}` ) ),
          )
          .catch( () => console.log( `Cannot create DM with the user ${member.displayName}` ) ),
        )
      }, 1000 * 10 )
    } ),
  ],

  commands: new Scope( {}, {
    nobody: new DCExecutor( { perms:`_NOBODY` }, () => {} ),

    // "!": new Scope( {
    //   perms: [ `Inkwizytor` ],
    //   shortDescription: `Moce zarządu`,
    // }, {
    // } ),

    fun: new Scope( { sd:`Polecenia czysto rozrywkowe, generujące nawet i dziwne rzeczy` }, {
      emojis: new DCExecutor( {

      }, async $ => {
        const storage = await $.getStorage()
        const storageListKey = `lastEmojiListTime`
        const lastListTime = (storage && storage.get( storageListKey )) ?? 0

        if (lastListTime > Date.now() - 1000 * 60 * 30) {
          $.channel?.send( `Spróbuj wywołać listę emoji później, przykładowo za godzinę` )
          return
        }

        storage.set( storageListKey, Date.now() )

        const data = []
        let count = 0

        $.bot.client.guilds.cache.forEach( guild => {
          const emojis = []

          guild.emojis.cache.forEach( ({ id, name, animated }) => {
            const field = `<${animated ? `a` : ``}:${name}:${id}> \`${name}\``
            const offset = ` `.padStart( 20 - name.length )

            emojis.push( `${field} \`${offset}\`` )
          } )

          count += emojis.length
          data.push({ guild:guild.name, emojis })
        } )

        await $.channel.send( ``
          + `Znaleziono **${count}** emotikon\n`
          + `Aby użyć któregoś z tych emoji wpisz <nazwa_emoji>`,
        )

        for (const { guild, emojis } of data) {
          if (!emojis.length) return

          await $.channel.send( `> **${guild}**:` )

          for (let i = 0;  i < emojis.length;  i += 20) {
            let msg = ``

            for (let j = 0;  j < 5;  ++j) {
              msg += emojis.slice( i + j * 4, i + j * 4 + 4 ).join( ` ` ) + `\n`
            }

            await $.channel.send( msg )
          }
        }

        await $.channel.send( `I to już wszystko` )
      } ),

      kot: new DCExecutor( {
        params: [
          { name:`Odwrócone ręce`, type:`bool`, optional:true },
          { name:`Wiadomość`, type:`message`, optional:true },
        ],
      }, ($, inverted, message) => {
        const ctxEmoji = createCanvas( 50, 50 ).getContext( `2d` )
        const avatarUrl = $.member.user.avatarURL().match( /(.*)\.\w+$/ )[ 1 ] + `.png`

        Promise.all([
          loadImage( avatarUrl ),
          loadImage( `https://i.imgur.com/VSIrrpN.png` ),
        ]).then( async([ avatar, kot ]) => {
          const { width, height } = ctxEmoji.canvas

          ctxEmoji.clearRect( 0, 0, width, height )
          ctxEmoji.drawImage( avatar, 0, 0, 50, 50 )

          if (inverted) {
            ctxEmoji.translate( 50, 0 )
            ctxEmoji.scale( -1, 1 )
            ctxEmoji.drawImage( kot, 0, 0, 50, 50 )
          } else ctxEmoji.drawImage( kot, 0, 0, 50, 50 )

          const webhook = await $.getWebHook()

          $.deleteMsg()

          await webhook?.send({
            content: message,
            username: $.member.displayName,
            avatarURL: $.member.user.displayAvatarURL(),
            files: [ ctxEmoji.canvas.toBuffer() ],
          })

          return webhook
        } ).catch( () => {
          $.send( `Nie udało się wczytać wymaganych grafik. Potrzebna interwencja programisty` )
        } )
      } ),

      mur: new DCExecutor( {
        params: [
          {
            name: `Parametry`,
            type: `message`,
            optional: true,
            desc: ``
              + `"alt": Zastosuj "kot" lub "zeber" zamiast muru\n`
              + `"m": Lustrzanie odbita grafika\n`
              + `"s": Wyłączenie wygładzania krawędzi\n`
              + `"x=X": Przesuń emoji/avatar w poziomie o X\n`
              + `"r=X": Obróć emoji/avatar o X stopni\n`
              + `"p=X": Pomniejsz emoji/avatar o X pikseli`
              + `"mp=X": Pomniejsz mur o X pikseli`
              + `"mx=X": Przesuń mur o X\n`
              + `"mr=X": Obróć mur o X stopni\n`
              + `"mm": Przerzuć mur na lewo\n`
              + `"md": Wyłącz/usuń mur\n`
              + `*server emoji*: Emoji do zamurowania`,
          },
        ],
      }, ($, paramsStr) => {
        const ctxEmoji = createCanvas( 50, 50 ).getContext( `2d` )
        const params = !paramsStr ? {} : paramsStr.split( / +/g ).reduce( (obj, p) => {
          if (/<:\w+:\d{18,19}>/.test( p )) obj[ `emoji` ] = p
          else {
            const match = p.split( `=` )

            if (match) obj[ match[ 0 ] ] = match[ 1 ] ?? true
          }

          return obj
        }, {} )

        let imageUrl = $.member.user.avatarURL().match( /(.*)\.\w+$/ )[ 1 ] + `.png`
        let emoji = undefined

        if (params.emoji) {
          const emojiId = params.emoji.match( /\d+/g )[ 0 ]

          emoji = $.msg.guild.emojis.resolve( emojiId )

          if (!emoji) {
            $.msg.channel.send( `Podane emoji nie zostało znalezione i nie można go zamurować.` )
            return
          }

          imageUrl = emoji.url
        }

        Promise.all([
          loadImage( imageUrl ),
          params.alt == `kot` ? loadImage( `https://i.imgur.com/VSIrrpN.png` ) // kot
            : params.alt == `zeber` ? loadImage( `https://i.imgur.com/cz2r26C.png` ) // zeber
              : loadImage( `https://i.imgur.com/qnOY3PP.png` ), // mur
          // loadImage( `https://cdn.discordapp.com/attachments/364471561803268097/982228142653591572/mur.png` ),
        ]).then( async([ avatar, mur ]) => {
          const { width, height } = ctxEmoji.canvas
          const dx = params.i ? 15 : -15
          const translateX = params.x ? Number( params.x ) : 0
          const rotate = params.r ? Number( params.r ) : 0
          const graphicPpadding = params.p ? Number( params.p ) : 7
          const murPpadding = params.mp ? Number( params.mp ) : 0
          const rotateMur = params.mr ? Number( params.mr ) : 0
          const translateXMur = params.mx ? Number( params.mx ) : 0

          if (translateX) {
            const limit = 70

            if (Math.abs( translateX ) > limit) {
              $.msg.channel.send( `Podałeś liczbę, która wykracza poza rozmiar grafiki. Podałeś ${translateX}, dozwolona maksymalna wartość bezwzględna wynosi ${limit}` )
              return
            }
          }

          if (graphicPpadding < 0 || 20 < graphicPpadding) {
            $.msg.channel.send( `Padding grafiki jaki podałeś ${graphicPpadding} nie mieści się w wymaganym zakresie <0, 20>` )
            return
          }

          if (murPpadding < 0 || 20 < murPpadding) {
            $.msg.channel.send( `Padding muru jaki podałeś ${murPpadding} nie mieści się w wymaganym zakresie <0, 20>` )
            return
          }

          if (params.s) ctxEmoji.imageSmoothingEnabled = false
          ctxEmoji.clearRect( 0, 0, width, height )

          ctxEmoji.save()
          ctxEmoji.translate( width / 2 + translateX, height / 2 )
          if (params.m) ctxEmoji.scale( -1, 1 )
          ctxEmoji.rotate( Math.PI / 180 * rotate )
          ctxEmoji.drawImage( avatar,
            0, 0, avatar.width, avatar.height,
            -(width - graphicPpadding) / 2, -(height - graphicPpadding) / 2, width - graphicPpadding, height - graphicPpadding,
          )
          ctxEmoji.restore()

          if (!params.md) {
            const halfPadding = murPpadding / 2

            ctxEmoji.save()
            ctxEmoji.translate( (params.mm ? 0 : width / 2) + translateXMur, height / 2 )
            ctxEmoji.rotate( Math.PI / 180 * rotateMur )
            ctxEmoji.drawImage( mur, -13 / 2 - 4 + halfPadding, -height / 2 + halfPadding, 50 - murPpadding, 50 - murPpadding )
            ctxEmoji.restore()
          }

          const webhook = await $.getWebHook()

          $.msg.delete()

          await webhook?.send({
            username: $.msg.member.displayName,
            avatarURL: $.msg.author.displayAvatarURL(),
            files: [ ctxEmoji.canvas.toBuffer() ],
          })

          return webhook
        } )
      } ),

      stone: new DCExecutor( {}, async $ => {
        const msgsCollection = await $.channel.messages.fetch({ limit:3 })
        const msgs = Array.from( msgsCollection.values() )
        const chance = Math.random()
        /** @type {number} */ let msgIndex = undefined

        if (chance >= .85) msgIndex = 2
        else if (chance >= .6) msgIndex = 1
        else if (chance >= .4) msgIndex = 0

        const choosenMsg = msgs[ msgIndex ]

        if (choosenMsg?.member.id == `379234773408677888`) {
          const msg1 = ``
            + `*${$.member.displayName} rzuca kamieniem*    (╯°□°）╯<:stone:539048004011687939> \n`
            + `Kakt... `

          const msg2 = ``
            + `*${$.member.displayName} rzuca kamieniem*    (╯°□°）╯<:stone:539048004011687939> \n`
            + `<:stone:539048004011687939><:stone:539048004011687939> **i został brutalnie zmasakrowany!** <:stone:539048004011687939>`

          $.deleteMsg()
          $.send( msg1 )
            .then( m => new Promise( r => setTimeout( () => r( m ), 1000 ) ) )
            .then( m => m.delete() )
            .then( () => $.channel.send( msg2 ) )
        } else {
          const addon = choosenMsg
            ? (chance >= .97 || choosenMsg.member.displayName === $.member.displayName)
              ? `**xD z typa** bo sam od siebie`
              : `${msgs[ msgIndex ]} oberwał`
            : `Pudło 🤦`

          $.deleteMsg()
          $.send( `*${$.member.displayName} rzuca kamieniem*    (╯°□°）╯<:stone:539048004011687939> \n${addon}` )
        }
      } ),
    } ),

    dialog: new Scope( { sd:`Wstawki (najczęściej dźwiękowe) mogące przydać się w dyskusji` }, {
    } ),

    // jam: new Scope( { sd:`Strefa CactuJam!` }, {

    // } ),

    info: new Scope( { sd:`Informacje o sobie i innych. Rozwojowo także o rzeczach wszelakich` }, {

    } ),

    random: new DCExecutor( {
      shortDescription: `Rzuć moneta, lub wylosuj liczbę`,
      params: [
        { name:`Liczba 1`, type:`number`, optional:true, desc:`jedna z liczb z zakresu. Jeśli nie zostanie podany drugi parametr, jest to liczba w przedziale <0, X>.` },
        { name:`Liczba 2`, type:`number`, optional:true, desc:`Druga liczba zakresu` },
      ],
    }, ($, numA, numB) => {
      const coin = numA === undefined && numB === undefined
      let min = Math.min( numA ?? 0, numB ?? 0 )
      let max = Math.max( numA ?? 0, numB ?? 0 )

      if (coin) {
        min = 0
        max = 1
      }

      const rand = Math.floor( Math.random() * (max - min + 1) ) + min
      const message = coin
        ? `Wykonano rzut monetą\nWylosowana wartość to **${rand === 1 ? `orzeł` : `reszka`}**`
        : `Z zakresu <**\`${min}\`**; **\`${max}\`**> wylosowano **${rand}**`

      $.send({
        content: message,
        components: [
          {
            type: 1,
            components: [
              {
                type: 2,
                label: `Reroll`,
                style: 1,
                custom_id: `random`,
              },
            ],
          },
        ],
      })
    } ),

    storm: new DCExecutor( { sd:`Pokaż mapę burzową Polski` }, $ => {
      const link = `http://images.blitzortung.org/Images/image_b_pl.png?mapId=${Date.now()}`
      const header = `**${$.member} wezwał burzę!**`

      $.send( `${header}\n${link}` ) // .then( m => m.react( `🔄` ) )
      $.deleteMsg()
    } ),

    mc: new DCExecutor( {
      sd: `Sprawdź status serwera Minecraft`,
      params: [ { name:`address`, type:`string`, optional:true } ],
    }, async($, address = `152.70.188.72`) => {
      const status = await fetch( `https://api.mcsrvstat.us/3/${address}` ).then( r => r.json() )

      if (!status.debug.ping) return $.send({ embeds: [
        {
          title: `Niepowodzenie`,
          description: `Odczytywanie statusu serwera spod adresu **${address}** zakończyło się niepowodzeniem`,
        },
      ] })

      $.send({ embeds: [
        {
          title: `Status serwera`,
          description: ``
            + status.motd.clean.join( `\n` ) + `\n`
            + `- **Wersja**: ${status.version}\n`
            + `- **Liczba modyfikacji**: ` + (!(`mods` in status) ? `0, brak modów` : `${status.mods.length} modów`) + `\n`
            + `- **Liczba graczy**: ${status.players.online}/${status.players.max} \n`
            + (!(`list` in status.players) ? `` : `- **Lista graczy**: ${status.players.list.map( p => p.name ).join( `, ` )}`),
          thumbnail: {
            url: !(`icon` in status) ? `` : `https://eu.mc-api.net/v3/server/favicon/${address}`,
          },
        },
      ] })
    } ),

    ask: new DCExecutor( { sd:`Wyślij informacje o idei "Don't ask to ask"` }, $ => {
      $.deleteMsg()

      const text = ``
        + `Po prostu zadaj pytanie, zamiast pytać o pytanie. `
        + `Moze być przecież tak (i to się nie zdarza rzadko), `
        + `że do konkretnego pytania zgłosi się więcej osób niż do nic niemówiącego ogólnika.`

      $.send( `${text}\nhttps://dontasktoask.com` )
    } ),

    // error: new DCExecutor( { shortDescription:`Wywołaj bład w kodzie polecenia` }, async $ => {
    //   try {
    //     $.channel.messages.fetch( `asd` )
    //   } catch {
    //     console.log( `sync err` )
    //   }
    // } ),

    // test: new DCExecutor( {
    //   params: [ { name:`value`, type:`message`, desc:`Zapisz wartość`, optional:true } ],
    // }, async($, value) => {
    //   const key = `storageTest`
    //   const storage = await $.getStorage()

    //   if (value) {
    //     await storage.set( key, value )
    //     $.send( `Wartość zapisano` )
    //   } else {
    //     const value = storage.get( key )
    //     $.send( `Zapisana wartość: ${value}` )
    //   }
    // } ),
  } ),

  slashCommands: {
    random: new DCCmdExecutor( {
      params: [
        { name:`Liczba 1`, type:`number`, optional:true, desc:`Pierwsza z liczb z zakresu lub liczba w przedziale <0, X>.` },
        { name:`Liczba 2`, type:`number`, optional:true, desc:`Druga liczba zakresu` },
      ],
    }, async $ => {
      $.runCmd( `random` )
    } ),
  },
})

return dcModule
