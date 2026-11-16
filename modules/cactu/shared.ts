import type { WebhookMessageCreateOptions } from "discord.js"
import type { CommandCtx, FilterCtx } from "cactu-discord.js"
import type { CactuSettings } from "./kit.js"

export type CactuCommandCtx = CommandCtx<CactuSettings>
/** What a filter's matcher sees: everything of the filter's context except the match it's deciding about */
export type CactuFilterMatchCtx = Omit<FilterCtx<CactuSettings>, `match`>

export async function deleteCommandMessage( ctx:CactuCommandCtx ) {
  if (ctx.source === `message`) await ctx.message.delete().catch( () => undefined )
}

/** Sends through the channel's webhook with the caller's name and avatar, replacing the command message */
export async function sendAsMember( ctx:CactuCommandCtx, content:WebhookMessageCreateOptions ) {
  const webhook = await ctx.bot.getWebHook( ctx.channel )
  if (!webhook) return ctx.send( `Na tym kanale nie mogę pisać w twoim imieniu (brak webhooka)` )

  await deleteCommandMessage( ctx )
  await webhook.send({
    ...content,
    username: ctx.member?.displayName,
    avatarURL: ctx.member?.displayAvatarURL(),
    threadId: ctx.channel?.isThread() ? ctx.channel.id : undefined,
  })
}

export function wait( milliseconds:number ) {
  return new Promise( resolve => setTimeout( resolve, milliseconds ) )
}
