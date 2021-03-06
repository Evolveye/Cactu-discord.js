export default class Logger {
  /**
   * @param {{ align?:"left"|"center"|"right", color?:String, length?:Number }[]} parts Color is a console color name
   */
  constructor( parts ) {
    let pattern = ''

    for ( const { color='fgWhite' } of parts )
      pattern += ''
        + (Logger.colors[ color ] || '')
        + '%s'
        + Logger.colors.reset

    return (...items) => {
      for (let i = 0; i < items.length; i++) {
        const part = parts[ i ]

        if (!part) break

        const { align='left', length=10, splitLen, splitFLLen } = part
        let len = length - items[ i ].length
        let item = items[ i ]

        if (len < 0) len = 0

        switch (align) {
          case 'left':
            item += ' '.repeat( len )
            break

          case 'right':
            item = `${' '.repeat( len )}${item}`
            break

          case 'center':
            for (let j = len; j; j--)
              if (j % 2) item += ' '
              else item = ` ${item}`
            break
        }

        if (splitLen) item = Logger.split( item, splitLen, splitFLLen || splitLen )

        items[ i ] = item.replace( /\n/g, '\n     | ' )
      }

      console.log( pattern, ...items )
    }
  }

  /** Split the long one line to several shorter lines
   * @param {String} string
   * @param {Number} lineLength
   * @param {Number} firstLineLength
   */
  static split( string, lineLength, firstLineLength=lineLength ) {
    const lBrReg = /[- ,:;.]/
    const fL = firstLineLength
    const l = lineLength

    let cLL // current line length
    let chrsFrStart = 0

    for (let i = 0; chrsFrStart < string.length - (cLL = i == 0 ? fL : l); i++) {
      let retreat = 0

      while (retreat < 15 && !lBrReg.test( string[ chrsFrStart + cLL - retreat ] )) retreat++

      chrsFrStart = chrsFrStart + cLL - retreat

      switch (string[ chrsFrStart ]) {
        case ' ':
          string = `${string.slice( 0, chrsFrStart )}\n${string.slice( chrsFrStart + 1 )}`
          chrsFrStart++
          break

        case ',':
        case ':':
        case ';':
        case '-':
          string = `${string.slice( 0, chrsFrStart + 1 )}\n${string.slice( chrsFrStart + 1 )}`
          break

        case '.':
          string = `${string.slice( 0, chrsFrStart )}\n${string.slice( chrsFrStart )}`
          break
      }
    }

    return string
  }
}

Logger.colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  dim: '\x1b[2m',
  underscore: '\x1b[4m',
  blink: '\x1b[5m',
  reverse: '\x1b[7m',
  hidden: '\x1b[8m',

  fgBlack: '\x1b[30m',
  fgRed: '\x1b[31m',
  fgGreen: '\x1b[32m',
  fgYellow: '\x1b[33m',
  fgBlue: '\x1b[34m',
  fgMagenta: '\x1b[35m',
  fgCyan: '\x1b[36m',
  fgWhite: '\x1b[37m',

  bgBlack: '\x1b[40m',
  bgRed: '\x1b[41m',
  bgGreen: '\x1b[42m',
  bgYellow: '\x1b[43m',
  bgBlue: '\x1b[44m',
  bgMagenta: '\x1b[45m',
  bgCyan: '\x1b[46m',
  bgWhite: '\x1b[47m'
}