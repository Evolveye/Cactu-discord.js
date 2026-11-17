/* The Discord message of each event: Polish text from the language file, posted as the player (their name and head) */

import { escapeText, fillTranslation, renderText } from "./text.js"
import { createHeadUrl } from "./heads.js"
import type { TranslationLookup } from "./text.js"
import type { MinecraftEvent } from "../events.js"

/** Posted by a webhook with the player's name and head; the message's time is the event's */
export type MinecraftMessage = { username: string, avatarURL: string, content: string }

/** Polish format strings for keys missing in the language file (no MINECRAFT_VERSION, a failed download) */
const FALLBACK_FORMATS:Record<string, undefined | string> = {
  "chat.type.advancement.task": `%s zdobywa osiągnięcie %s`,
  "chat.type.advancement.goal": `%s osiąga cel %s`,
  "chat.type.advancement.challenge": `%s ukończa wyzwanie %s`,
  "multiplayer.player.joined": `%s dołącza do gry`,
  "multiplayer.player.left": `%s opuszcza grę`,
}

/** Discord's limit */
const CONTENT_LENGTH = 2000

export function createMinecraftMessage( event:MinecraftEvent, lookup:TranslationLookup ): MinecraftMessage {
  const { player } = event
  return { username:player.name, avatarURL:createHeadUrl( player.uuid ), content:truncate( describeEvent( event, lookup ), CONTENT_LENGTH ) }
}

function describeEvent( event:MinecraftEvent, lookup:TranslationLookup ) {
  const playerName = `**${escapeText( event.player.name, `markdown` )}**`
  const translate = (key:string, args:string[]) => fillTranslation( lookup( key ) ?? FALLBACK_FORMATS[ key ] ?? key, args, `markdown` )

  switch (event.type) {
    // The game's own phrase, e.g. "%s zdobywa osiągnięcie %s", with the description as subtext below
    case `advancement`: {
      const { title, description, frame } = event.data
      const titleText = `**${renderText( title, lookup, `markdown` )}**`
      const descriptionLines = renderText( description, lookup, `markdown` ).split( `\n` ).filter( line => line.trim() )

      return [ translate( `chat.type.advancement.${frame}`, [ playerName, titleText ] ), ...descriptionLines.map( line => `-# ${line}` ) ].join( `\n` )
    }

    // Hidden death messages (or one that renders empty) get a short generic one
    case `death`: {
      const message = event.data.message === null ? `` : renderText( event.data.message, lookup, `markdown` )
      return `💀 ${message.trim() || `${playerName} nie żyje`}`
    }

    case `join`: return event.data.firstJoin
      ? `🎉 ${playerName} dołącza do gry po raz pierwszy. Witamy na serwerze!`
      : translate( `multiplayer.player.joined`, [ playerName ] )

    case `quit`: return translate( `multiplayer.player.left`, [ playerName ] )
  }
}

function truncate( text:string, maxLength:number ) {
  return text.length > maxLength ? `${text.slice( 0, maxLength - 1 )}…` : text
}
