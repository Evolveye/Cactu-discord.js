/*
  The Minecraft server's events (advancements, deaths, joins, quits), posted in the namespace's `channelId` channel as the player.
  The Cactu backend forwards them to `POST /api/<namespace id>/minecraft/events` on the bot's HTTP server (see MINECRAFT_EVENTS_BOT.md);
  it also deduplicates and orders them, so every accepted event simply gets posted.
  Texts are translated with the Polish language file of MINECRAFT_VERSION, cached in _translation/<version>/.
*/

import { channel, createModuleKit } from "cactu-discord.js"
import { postMinecraftEvent } from "./poster.js"
import { parseMinecraftEvent } from "./events.js"

const { defineModule } = createModuleKit({
  channelId: channel(),
})

export default defineModule({
  endpoints: {
    "POST /events": ({ client, settings, request }) => {
      const parsed = parseMinecraftEvent( request.body )

      if (parsed.kind === `invalid`) {
        console.log( `minecraft: rejected a Minecraft event (${parsed.reason})` )
        return 400
      }

      if (parsed.kind === `unknown`) return 204

      postMinecraftEvent( client, settings.channelId, parsed.event )
        .catch( (error:Error) => console.log( `minecraft: a Minecraft event wasn't posted (${error.message})` ) )

      return 204
    },
  },

  setup: () => {
    if (!process.env.MINECRAFT_VERSION) console.log( `minecraft: MINECRAFT_VERSION isn't set, so Minecraft texts stay untranslated` )
  },
})
