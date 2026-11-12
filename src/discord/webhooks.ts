import { ChannelType } from "discord.js"
import type { Channel, ThreadChannel } from "discord.js"

const WEBHOOK_NAME = `CactuHaczyk`
const WEBHOOK_AVATAR = `https://cdn.discordapp.com/avatars/379234773408677888/a062f0b67e42116104554c1d3e3b695f.png?size=2048`

/** Returns the bot's webhook of a text channel (a public thread uses its parent's), creating it on first use */
export async function getWebHook( channel:null | Channel | ThreadChannel ) {
  if (!channel) return null

  const guildChannel = channel.type === ChannelType.PublicThread ? channel.parent : channel
  if (guildChannel?.type !== ChannelType.GuildText) return null

  const hooks = await guildChannel.fetchWebhooks().catch( console.log ).then( hook => hook ?? null )
  const existingHook = hooks?.find( ({ name }) => name === WEBHOOK_NAME )
  if (existingHook) return existingHook

  return guildChannel.createWebhook({ name:WEBHOOK_NAME, avatar:WEBHOOK_AVATAR })
    .catch( console.log ).then( hook => hook ?? null )
}
