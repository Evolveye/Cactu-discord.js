import type { EventCtx, EventsDefinition } from "cactu-discord.js"
import type { CactuSettings } from "./kit.js"

export const membersEvents:EventsDefinition<CactuSettings> = {
  guildMemberAdd: (member, ctx) => logMembers( ctx, `<:plus:749609803482923098> Na serwer dołączył użytkownik **${member.displayName}** (id=${member.id})` ),
  guildMemberRemove: (member, ctx) => logMembers( ctx, `<:minus:749609815701192735> Serwer opuścił użytkownik **${member.displayName ?? member.nickname}** (id=${member.id})` ),
}

async function logMembers( ctx:EventCtx<CactuSettings>, text:string ) {
  const channelId = ctx.settings.membersLogChannelId
  if (!channelId) return

  const channel = await ctx.client.channels.fetch( channelId ).catch( () => null )
  if (!channel?.isSendable()) return console.log( `cactu: the members log channel ${channelId} isn't available` )

  await channel.send({ content:text, allowedMentions:{ parse:[] } })
}
