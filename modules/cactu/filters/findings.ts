import { filter } from "../kit.js"
import type { CactuFilterMatchCtx } from "../shared.js"

const LINK = /https?:\/\/\w+\.\w{2,}/

/** In the findings channel, only messages with an attachment or a link may stay */
export const findingsFilter = filter( isFindingWithoutSource, ctx => ctx.message.delete() )

function isFindingWithoutSource( ctx:CactuFilterMatchCtx ) {
  if (!(`name` in ctx.channel) || ctx.channel.name !== ctx.settings.findingsChannelName) return false

  return !ctx.message.attachments.size && !LINK.test( ctx.message.content )
}
