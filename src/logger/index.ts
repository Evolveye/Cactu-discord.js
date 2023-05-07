import { Color, colors, colorsReg } from "./colors.js"
import { TupleCount, NegativeTupleCount, Tuple } from "./CountTuple.js"

type FixedLogDataPart = {
  value: string | (() => string)
}
export type LoggerPart = Partial<FixedLogDataPart> & {
  align?: "left" | "center" | "right"
  color?: Color
  minLength?: number
  maxLength?: number
}

export type LoggerConfig = {
  maxLineLength?: number
}

export default class Logger<Parts extends readonly LoggerPart[]> {
  static breakLineChars = ` ,:;-.`
  static defaultColor: null | Color = `fgWhite`
  static defaultBackground: null | Color = null

  #pattern: string = ``
  #parts: readonly LoggerPart[]
  config: LoggerConfig

  constructor( parts:Parts, config:LoggerConfig = {} ) {
    this.#parts = parts
    this.config = config

    for (const { color = `fgWhite` } of parts) {
      this.#pattern += ``
        + (colors[ color ] || ``)
        + `%s`
        + colors.reset
    }
  }

  log( ...items:Tuple<string, NegativeTupleCount<Parts, FixedLogDataPart>> ) {
  // log( items:NegativeTupleCount<Parts, FixedLogDataPart> ) {
  // log( ...items:Tuple<string, NegativeTupleCount<Parts, FixedLogDataPart>> ) {
    const { maxLineLength } = this.config

    for (let i = 0;  i < items.length;  i++) {
      const part = this.#parts[ i ]
      let item = items[ i ]

      if (!item || !part) break

      const { align = `left`, minLength = 0, color } = part
      const mainColor = Logger.defaultColor ?? `fgWhite`

      let len = minLength - item.length

      if (len < 0) len = 0

      switch (align) {
        case `left`:
          item += ` `.repeat( len )
          break

        case `right`:
          item = ` `.repeat( len ) + item
          break

        case `center`:
          for (let j = len;  j;  j--)
            if (j % 2) item += ` `
            else item = ` ` + item
          break
      }

      if (maxLineLength) item = Logger.split( item, maxLineLength )

      const lineBreak = `\n     | `
      items[ i ] = item
        .replace( /\n/g, lineBreak )
        // .replace( colorsReg, (...match) => {
        //   const { fragColor, data } = match[ match.length - 1 ]
        //   const text = data.replace( new RegExp( lineBreak.replace( /\|/g, `\\|` ), `g` ), `\n     ${colors[ mainColor ]}| ${colors[ fragColor ]}` )

      //   return `${colors[ fragColor ]}${text}${colors[ color ?? `fgWhite` ]}`
      // } )
    }

    console.log( this.#pattern, ...items )
  }

  static split( logString:string, lineLength:number ) {
    const { breakLineChars } = Logger
    let lastLineBreak = { charIndex:0, prevCharIndex:0, char:`` }
    let currentLineLength = 0

    for (let i = 0;  i < logString.length;  i++) {
      const char = logString[ i ]

      if (!char) break
      if (breakLineChars.includes( char ) && logString[ i - 1 ] != `\n` && currentLineLength != lineLength) {
        lastLineBreak.charIndex = i
        lastLineBreak.char = char
      }

      currentLineLength++

      if (currentLineLength <= lineLength) continue
      if (!lastLineBreak.charIndex || i - lastLineBreak.charIndex > 15 || lastLineBreak.charIndex == lastLineBreak.prevCharIndex) {
        logString = `${logString.slice( 0, i )}\n${logString.slice( i )}`
        currentLineLength = 0
        continue
      }

      lastLineBreak.prevCharIndex = lastLineBreak.charIndex
      currentLineLength = i - lastLineBreak.charIndex

      switch (lastLineBreak.char) {
        case ` `:
          logString = `${logString.slice( 0, lastLineBreak.charIndex )}\n${logString.slice( lastLineBreak.charIndex + 1 )}`
          break

        case `,`:
        case `:`:
        case `;`:
        case `-`:
          logString = `${logString.slice( 0, lastLineBreak.charIndex + 1 )}\n${logString.slice( lastLineBreak.charIndex + 1 )}`
          currentLineLength -= 1
          break

        case `.`:
          logString = `${logString.slice( 0, lastLineBreak.charIndex )}\n${logString.slice( lastLineBreak.charIndex )}`
          break
      }
    }

    return logString
  }
}
