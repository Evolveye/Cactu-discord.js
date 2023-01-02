export type LoggerPart = {
  align?: "left" | "center" | "right"
  color?: keyof typeof Logger.colors
  minLength?: number
}

export type LoggerConfig = {
  maxLineLength?: number
}

export default class Logger {
  static breakLineChars = ` ,:;-.`

  #pattern: string = ``
  #parts: LoggerPart[]
  config: LoggerConfig

  constructor( parts:LoggerPart[], config:LoggerConfig = {} ) {
    this.#parts = parts
    this.config = config

    for (const { color = `fgWhite` } of parts) {
      this.#pattern += ``
        + (Logger.colors[ color ] || ``)
        + `%s`
        + Logger.colors.reset
    }
  }

  log = (...items:string[]) => {
    const { maxLineLength } = this.config

    for (let i = 0;  i < items.length;  i++) {
      const part = this.#parts[ i ]
      let item = items[ i ]

      if (!item || !part) break

      const { align = `left`, minLength = 0 } = part
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

      items[ i ] = item.replace( /\n/g, `\n     |` )
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

  static colors = {
    reset: `\x1b[0m`,
    bright: `\x1b[1m`,
    dim: `\x1b[2m`,
    underscore: `\x1b[4m`,
    blink: `\x1b[5m`,
    reverse: `\x1b[7m`,
    hidden: `\x1b[8m`,

    fgBlack: `\x1b[30m`,
    fgRed: `\x1b[31m`,
    fgGreen: `\x1b[32m`,
    fgYellow: `\x1b[33m`,
    fgBlue: `\x1b[34m`,
    fgMagenta: `\x1b[35m`,
    fgCyan: `\x1b[36m`,
    fgWhite: `\x1b[37m`,

    bgBlack: `\x1b[40m`,
    bgRed: `\x1b[41m`,
    bgGreen: `\x1b[42m`,
    bgYellow: `\x1b[43m`,
    bgBlue: `\x1b[44m`,
    bgMagenta: `\x1b[45m`,
    bgCyan: `\x1b[46m`,
    bgWhite: `\x1b[47m`,
  }
}
