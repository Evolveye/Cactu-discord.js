/* Minecraft's JSON text components rendered into plain text or Discord markdown, translated with the language files */

import { escapeMarkdown } from "discord.js"
import type { TextComponent } from "../events.js"

/** `plain` for places without markdown (an embed's footer), `markdown` escapes the game's text */
export type TextFormat = `plain` | `markdown`

export type TranslationLookup = (key:string) => undefined | string

/** The fields that matter; styling and interaction (`color`, `hoverEvent`, `clickEvent`, `insertion`…) are ignored */
type ComponentObject = { text?: unknown, translate?: unknown, fallback?: unknown, with?: unknown, extra?: unknown }

/** `%s` (and `%d`) in order, `%1$s` by a 1-based index, `%%` a literal percent */
const PLACEHOLDER = /%(?:(\d+)\$)?([sd%])/g

export function renderText( component:TextComponent, lookup:TranslationLookup, format:TextFormat ): string {
  if (typeof component === `string`) return escapeText( component, format )
  if (typeof component === `number` || typeof component === `boolean`) return String( component )
  if (Array.isArray( component )) return component.map( child => renderText( child, lookup, format ) ).join( `` )
  if (typeof component !== `object` || component === null) return ``

  const { text, translate, fallback, with:args, extra } = component as ComponentObject
  const ownText = typeof translate === `string`
    ? fillTranslation( lookup( translate ) ?? (typeof fallback === `string` ? fallback : translate), toArray( args ).map( arg => renderText( arg, lookup, format ) ), format )
    : renderText( typeof text === `number` ? text : (typeof text === `string` ? text : ``), lookup, format )

  return ownText + toArray( extra ).map( child => renderText( child, lookup, format ) ).join( `` )
}

/** The arguments are already rendered; for markdown, only the format string's own text gets escaped */
export function fillTranslation( formatString:string, renderedArgs:string[], format:TextFormat ) {
  const pieces:string[] = []
  let nextArgIndex = 0
  let literalStart = 0

  for (const match of formatString.matchAll( PLACEHOLDER )) {
    const [ placeholder, position, conversion ] = match
    pieces.push( escapeText( formatString.slice( literalStart, match.index ), format ) )
    literalStart = match.index + placeholder.length

    if (conversion === `%`) pieces.push( `%` )
    else pieces.push( renderedArgs[ position ? Number( position ) - 1 : nextArgIndex++ ] ?? `` )
  }

  pieces.push( escapeText( formatString.slice( literalStart ), format ) )

  return pieces.join( `` )
}

/** Game text is user content (player names, renamed items): markdown gets escaped and mentions broken, so it shows as typed */
export function escapeText( text:string, format:TextFormat ) {
  if (format === `plain`) return text

  // A zero-width space after `@` and `<` breaks `@everyone`, `<@id>`, `<#id>` and the like
  return escapeMarkdown( text, { heading:true, bulletedList:true, numberedList:true, maskedLink:true } ).replace( /[@<]/g, `$&​` )
}

function toArray( value:unknown ) {
  return Array.isArray( value ) ? value as unknown[] : []
}
