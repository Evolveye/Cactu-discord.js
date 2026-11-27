import { filter } from "../kit.js"

/** The answers, in their order under the question: yes, don't know, no */
const POLL_REACTIONS = [ `👍`, `🤷`, `👎` ]

/** `cc? <question>` makes the message a simple poll: the bot reacts with the answers to vote with */
export const pollFilter = filter( /^cc\?\s*\S/i, async ctx => {
  // One at a time, so they show up in the order of POLL_REACTIONS
  for (const emoji of POLL_REACTIONS) await ctx.message.react( emoji )
} )
