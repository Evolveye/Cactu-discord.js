/** @typedef {import("discord.js").MessageReaction} MessageReaction */
/** @typedef {import("discord.js").User} User */
/** @typedef {import("discord.js").GuildMember} GuildMember */
/** @typedef {import("discord.js").Message} Message */
/** @typedef {import("discord.js").TextChannel} TextChannel */

const randomData = {
  somekRoleId: `743205434424557619`,
  somekEmojiId: `744230051733700672`,
  somekMessageId: `750775931664203856`,
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
  },
})