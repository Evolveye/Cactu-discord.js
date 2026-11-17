/* Posts an event in a channel or a thread as the player: the bot's webhook with their name and head */

import { getWebHook } from "cactu-discord.js"
import { createTranslationLookup, loadTranslations } from "./messages/translations.js"
import { createMinecraftMessage } from "./messages/index.js"
import type { Client } from "discord.js"
import type { MinecraftEvent } from "./events.js"

/** Game text could hold mentions; nobody gets pinged by it */
const NO_MENTIONS = { parse:[] }

export async function postMinecraftEvent( client:Client, channelId:string, event:MinecraftEvent ) {
  const translations = await loadTranslations( process.env.MINECRAFT_VERSION )
  const { username, avatarURL, content } = createMinecraftMessage( event, createTranslationLookup( translations ) )

  const channel = await client.channels.fetch( channelId ).catch( () => null )
  if (!channel?.isSendable()) throw new Error( `the channel ${channelId} isn't available` )

  // Without the "Manage Webhooks" permission: the bot's own message, which names the player in its text anyway
  const webhook = await getWebHook( channel )
  if (!webhook) return channel.send({ content, allowedMentions:NO_MENTIONS })

  // The webhook belongs to the thread's parent channel, so the thread is named in the message
  const threadId = channel.isThread() ? channel.id : undefined

  return webhook.send({ username, avatarURL, content, threadId, allowedMentions:NO_MENTIONS })
}
