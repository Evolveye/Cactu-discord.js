import canvasPackage from "canvas"

/** @typedef {import("discord.js").MessageReaction} MessageReaction */
/** @typedef {import("discord.js").User} User */
/** @typedef {import("discord.js").GuildMember} GuildMember */
/** @typedef {import("discord.js").Message} Message */
/** @typedef {import("discord.js").TextChannel} TextChannel */

const { createCanvas, loadImage } = canvasPackage
const ctxKot = createCanvas( 50, 50 ).getContext( `2d` )
const randomData = {
  somekRoleId: `743205434424557619`,
  somekEmojiId: `744230051733700672`,
  somekMessageId: `750775931664203856`,
  somekRuResponses: [
    `mindustry.ru is shit`,
    `#remove mindustry.ru`,
    `Fuck mindustry.ru`,
  ],
}
/**
 * @module
 * @param {import("../GuildModules.js").UnsafeVariables} $
 * @returns {import("../GuildModules.js").GuildModule}
 */
export default $ => ({
  translation: {
  },
  events: {
    /**
     * @param {MessageReaction} reaction
     * @param {User} user
     */
    async messageReactionAdd( reaction, user ) {
      if (user.id == `379234773408677888`) return
      if (reaction.partial) await reaction.fetch()
      if (reaction.message.partial) await reaction.message.fetch()

      const { message } = reaction
      const { somekRoleId, somekMessageId, somekEmojiId } = randomData

      if (message.id == somekMessageId) {
        if (user.id != `389814624662454285` && reaction.emoji.id === somekEmojiId) {
          const role = message.guild.roles.cache.get( somekRoleId )

          if (role) {
            const member = await message.guild.members.fetch( user )

            member.roles.add( role )
            message.guild.channels.cache.get( `744221654409936896` ).send( `${member} took the "${role.name}" role` )
          } else {
            message.guild.channels.cache.get( `744221654409936896` ).send( `${member} wanted to get role, but error was apear` )
          }
        }
      }
    },

    /**
     * @param {MessageReaction} reaction
     * @param {User} user
     */
    async messageReactionRemove( reaction, user ) {
      if (reaction.partial) await reaction.fetch()
      if (reaction.message.partial) await reaction.message.fetch()

      const { message } = reaction
      const { channel } = message
      const { somekRoleId, somekMessageId, somekEmojiId } = randomData

      if (message.id != somekMessageId || reaction.emoji.id != somekEmojiId) return

      if (message.author.id == `389814624662454285`) {
        if (user.id != `389814624662454285`) {
          const role = message.guild.roles.cache.get( somekRoleId )
          const member = await message.guild.members.fetch( user )

          member.roles.remove( role )
        }
      }
    },
  },
  filters: [
    {[/./]() {
      const m = $.message
      const { content, channel, guild } = m

      if (channel.id === `758410789505335346`) {
        m.react( `750167880842215556` )
          .then( () => m.react( `750168003571613776` ) )
      } else $.setSharedData( `filterMatch`, false )
    }},
    {[/<\w+>/i]() {
      const m = $.message
      let replaced = false

      if (m.author.bot) return

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

        channel.createWebhook( `CactuHaczyk`, { avatar:`https://cdn.discordapp.com/avatars/379234773408677888/a062f0b67e42116104554c1d3e3b695f.png?size=2048` } )
          .then( async (webhook) => {
            m.delete()

            await webhook.send( message, {
              username: m.member.displayName,
              avatarURL: m.author.displayAvatarURL(),
            } ).catch( () => console.log( `Too long message` ) )

            return webhook
          } )
          .then( webhook => webhook.delete() )
          .catch( () => {} )
      } else $.setSharedData( `filterMatch`, false )
    }},
    {[/egg|oh no/i]() {
      const { content, guild } = $.message

      if (/egg/.test( content )) $.message.react( `🥚` )
      if (/oh no/.test( content )) $.message.react( guild.emojis.cache.find( ({ id }) => id === `745572446031315034` ) )
    }},
    {[/(?:^| )(?:mindustry\.ru|\.ru)(?:$| )/i]() {
      $.send( randomData.somekRuResponses[ Math.floor( Math.random() * randomData.somekRuResponses.length ) ] )
    }},
  ],
  commands: {
    $: { r:`@owner`, v:{
      tell: { d:`Send message by bot`, v( channelHash=/<#\d{18}>/g, text=/.+/ ) {
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
      delete: { d:`Remove messages`, v( amount=/\d+/ ) {
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
    }},
    random: { d:`Get the rando number from the range. Default range is <1;2>.`, v( min=/-?\d{1,10}/, max=/-?\d{1,10}/g ) {
      min = +min
      max = +max

      if (!max) max = 0
      if (min > max) [min, max] = [max, min]

      const rand = Math.floor( Math.random() * (max - min + 1) ) + min
      let message = `From range **${min}-${max}** I picked **${rand}**`

      $.send( message )
    }},
    mc: { d:`Check online status of Minecraft server`, v( addr=/.+/g ) {
      if (!addr) return m.channel.send( `You have to pass server address` )

      const m = $.message
      const address = addr

      fetch( `https://api.mcsrvstat.us/2/${encodeURIComponent( address )}` ).then( res => res.json() )
        .then( json => {
          if (!json.online) {
            return m.channel.send( `Passed address is not responding. It can be wrong, or server is off.` )
          }

          const { icon, players, mods, version, motd } = json
          const modsCount = mods ? mods.names.length : 0
          const embed = {
            color: 0x18d818,
            title: `Server information`,
            description: `**Address**: ${address}\n**MOTD**: ${motd.clean}`,
            fields: [
              { inline:true, name:`Online players`, value:`${players.online}/${players.max}` },
              { inline:true, name:`Game version`, value:version },
              { inline:true, name:`Mods?`, value:`${modsCount ? `Yes: ${modsCount}` : `No`}` },
            ]
          }

          if (players.online && players.list) {
            let list = players.list.slice( 0, 20 ).join( `, ` )

            if (players.list.length > 20) list += `, ...`

            embed.fields.push( { name:`Players list`, value:list } )
          }

          if (icon) {
            embed.thumbnail = { url:`attachment://file.jpg`, }

            m.channel.send( { files:[ new Buffer( icon.replace( /data:image\/\w+;base64,/, `` ), `base64` ) ], embed } )
          } else m.channel.send( { embed } )
        } )
        .catch( () => m.channel.send( `You passed wrong address` ) )
    }},
    omg: { d:`Grab your head(?)`, v( text=/.+/g ) {
      const m = $.message
      const avatarUrl = $.message.author.avatarURL()
        .match( /(.*)\.\w+$/ )[ 1 ] + `.png`

      Promise.all( [
        loadImage( avatarUrl ),
        loadImage( `https://cdn.discordapp.com/attachments/396728852115619864/767715223351197726/1603107961094.png` ),
      ] ).then( ([ avatar, kot ]) => {
        const { width, height } = ctxKot.canvas

        ctxKot.clearRect( 0, 0, width, height )
        ctxKot.drawImage( avatar, 0, 0, 50, 50 )
        ctxKot.drawImage( kot, 0, 0, 50, 50 )

        m.channel.createWebhook( `CactuHaczyk`, { avatar:`https://cdn.discordapp.com/avatars/379234773408677888/a062f0b67e42116104554c1d3e3b695f.png?size=2048` } )
          .then( async webhook => {
            m.delete()

            await webhook.send( text || ``, {
              username: m.member.displayName,
              avatarURL: m.author.displayAvatarURL(),
              files:[ ctxKot.canvas.toBuffer() ],
            } )

            return webhook
          } )
          .then( webhook => webhook.delete() )
          .catch( console.log )
      } )

    }},
  },
})