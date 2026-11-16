import { filter } from "../kit.js"
import type { Client } from "discord.js"
import type { CactuFilterMatchCtx } from "../shared.js"

const EMOJI_NAME = /<(\w+)>/g

/** `<emoji_name>` becomes that emoji from any of the bot's servers; the message is sent again as its author through a webhook */
export const emojisFilter = filter( hasServerEmojiNames, async ctx => {
  const { message } = ctx
  const replacedNames:string[] = []
  const content = message.content.replace( EMOJI_NAME, (match, name:string) => {
    const emoji = findEmoji( ctx.client, name )
    if (!emoji) return match

    replacedNames.push( name )
    return emoji.toString()
  } )

  if (!replacedNames.length) return

  const webhook = await ctx.bot.getWebHook( message.channel )
  if (!webhook) return console.log( `cactu: no webhook in the channel ${message.channelId}` )

  await message.delete()
  await webhook.send({
    content,
    username: message.member?.displayName ?? message.author.username,
    avatarURL: message.author.displayAvatarURL(),
    threadId: message.channel.isThread() ? message.channel.id : undefined,
  })
} )

/** A person's message with at least one `<name>` of an emoji the bot knows */
function hasServerEmojiNames( ctx:CactuFilterMatchCtx ) {
  if (ctx.message.author.bot) return false

  return [ ...ctx.message.content.matchAll( EMOJI_NAME ) ].some( ([ , name ]) => findEmoji( ctx.client, name! ) )
}

function findEmoji( client:Client, name:string ) {
  for (const guild of client.guilds.cache.values()) {
    const emoji = guild.emojis.cache.find( guildEmoji => guildEmoji.name === name )
    if (emoji) return emoji
  }

  return null
}
