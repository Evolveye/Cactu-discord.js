import { Color, colors, colorsReg } from "./colors.js"
import { NegativeTupleCount, Tuple } from "./CountTuple.js"

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
  newLineStarter?: string
  separated?: boolean
}

export type LastLogInfo = {
  instance: Logger<[]>
  separated: boolean
}

export default class Logger<Parts extends readonly LoggerPart[]> {
  static breakLineChars = ` ,:;-.`
  static defaultColor: Color = `fgWhite`
  static defaultBackground: null | Color = null
  static #lastLogsInfo: null | LastLogInfo = null

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
    const itemsCopy = [ ...items ] as string[]
    const { maxLineLength, newLineStarter = `   | ` } = this.config
    const outputValues:string[] = []
    const parts = [ ...this.#parts ]
    const lineBreak = `\n` + newLineStarter
    let logLength = 0

    for (let i = 0;  i < parts.length;  i++) {
      const part = parts[ i ]
      let value = ``

      if (part?.value) value = typeof part.value === `function` ? part.value() : part.value
      else value = itemsCopy.shift()!

      if (!part || !value) break

      const mainColor = Logger.defaultColor
      const { align = `left`, minLength = 0, color } = part
      const regExp = new RegExp( lineBreak.replace( /\|/g, `\\|` ), `g` )

      let valueLen = value.length

      if (value.includes( `[]` )) valueLen = value.replace( colorsReg, (...m) => m[ m.length - 1 ].data ).length

      let additionalSpace = minLength - value.length

      if (additionalSpace < 0) additionalSpace = 0

      switch (align) {
        case `left`:
          value += ` `.repeat( additionalSpace )
          break

        case `right`:
          value = ` `.repeat( additionalSpace ) + value
          break

        case `center`:
          for (let j = additionalSpace;  j;  j--)
            if (j % 2) value += ` `
            else value = ` ` + value
          break
      }

      if (maxLineLength) value = Logger.split( value, maxLineLength, { initialLength:logLength, notFirstLineMaxLength:maxLineLength - lineBreak.length } )

      const finalValue = value
        .replace( /\n/g, lineBreak )
        .replace( colorsReg, (...match) => {
          const { fragColor, data } = match[ match.length - 1 ]
          const text = data.replace( regExp, `\n` + colors[ mainColor ] + newLineStarter + colors[ fragColor ] )

          return `${colors[ fragColor ]}${text}${colors[ color ?? `fgWhite` ]}`
        } )

      logLength += valueLen + additionalSpace
      outputValues.push( finalValue )
    }

    const lastLoggerInfo = Logger.#lastLogsInfo
    const itsSeparated = this.config.separated ?? false

    if (lastLoggerInfo) {
      if ((lastLoggerInfo.separated || itsSeparated) && lastLoggerInfo.instance !== this) console.log( ` ` )
    }

    Logger.#lastLogsInfo = { instance:this, separated:itsSeparated }
    console.log( this.#pattern, ...outputValues )
  }

  static split( logString:string, lineLength:number, { initialLength = 0, notFirstLineMaxLength = lineLength } = {} ) {
    const { breakLineChars } = Logger
    let lastLineBreak = { charIndex:0, prevCharIndex:0, char:`` }
    let currentLineLength = initialLength

    for (let i = 0;  i < logString.length;  i++) {
      const char = logString[ i ]
      const currentLineMaxLength = lastLineBreak.prevCharIndex === 0 ? lineLength : notFirstLineMaxLength

      if (!char) break
      if (breakLineChars.includes( char ) && logString[ i - 1 ] != `\n` && currentLineLength != currentLineMaxLength) {
        lastLineBreak.charIndex = i
        lastLineBreak.char = char
      }

      currentLineLength++


      if (currentLineLength <= currentLineMaxLength) continue
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
