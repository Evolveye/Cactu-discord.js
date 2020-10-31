/** @typedef {"black"|"red"|"green"|"yellow"|"blue"|"magenta"|"cyan"|"white"} Color */
/** @typedef {"left"|"center"|"right"} Align */

/**
 * @typedef {Object} LoggerPart
 * @property {Color?} color
 * @property {Color?} background Background color
 * @property {Align?} align
 * @property {string?} value Static value
 * @property {number?} length Initial length
 * @property {number?} maxLen Max length
 * @property {number?} splitLen Length after which log will be splited
 * @property {number?} firstSplitLen Length after which log first line will be splited
 * @property {boolean?} bold is log bolded?
 */

/**
 * @typedef {Object} Options
 * @property {boolean} separated Do log should be separated from others?
 * @property {boolean} separateBreakBlock Do all log lines should start by \n?
 * @property {string} newLinePrefix
 */

export default class Logger {
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
    bgWhite: `\x1b[47m`
  }

  /** @type {Color} */
  static defaultColor = `white`
  static defaultBackground = ``
  static colorsReg = new RegExp( `\\[(?<color>${Object.keys( this.colors ).join( `|` )})](?<data>.*?)\\[]`, `gs` )

  /** @type {(items:string[]) => void} */
  #logger = null

  /**
   * @param {LoggerPart[]} parts
   * @param {Options?} options
   */
  constructor( parts, options={} ) {
    let pattern = ``

    for (const { color=Logger.defaultColor, background=Logger.defaultBackground, bold=false } of parts) pattern += ``
      + (Logger.colors[ `bg` + background.charAt( 0 ).toUpperCase() + background.slice( 1 ) ] || ``)
      + (Logger.colors[ `fg` + color.charAt( 0 ).toUpperCase() + color.slice( 1 ) ] || ``)
      + (bold ? Logger.colors.bright : ``)
      + `%s`
      + Logger.colors.reset

    const nonStaticPartsCount = parts.filter( ({ value }) => !value ).length

    this.isSeparated = options.separated
    this.#logger = items => {
      if (items.length != nonStaticPartsCount) {
        throw new Error( `Wrong count of passed items. Expected ${nonStaticPartsCount}, found ${items.length}` )
      }

      const preparedItems = []
      const date = Logger.getDate( options.locales )

      for (const part of parts) {
        const {
          color,
          align = `left`,
          value = items.shift(),
          length,
          maxLen,
          splitLen,
          firstSplitLen
        } = part

        const mainColor = color
          ? `fg` + color.charAt( 0 ).toUpperCase() + color.slice( 1 )
          : Logger.defaultColor
        let fieldLength = Math.max( length - value.length, 0 )
        let fieldValue = maxLen && value.length > maxLen
          ? `${value.slice( 0 , maxLen - 3 )}...`
          : value

        switch (align) {
          case `left`:
            fieldValue += ` `.repeat( fieldLength )
            break

          case `right`:
            fieldValue = ` `.repeat( fieldLength ) + fieldValue
            break

          case `center`:
            for (let i = fieldLength; i; i--)
              if (i % 2) fieldValue += ` `
              else fieldValue = ` ` + fieldValue
            break
        }

        if (splitLen) fieldValue = Logger.split( fieldValue, splitLen, {
          separateBreakBlock: options.separateBreakBlock,
          newLinePrefix: options.newLinePrefix,
          firstSplitLen,
        } )

        preparedItems.push( fieldValue.replace( /\n/g, `\n` + (options.newLinePrefix || `     | `) )
          .replace( `{YYYY}`, date.YYYY )
          .replace( `{MM}`, date.MM )
          .replace( `{DD}`, date.DD )
          .replace( `{hh}`, date.hh )
          .replace( `{mm}`, date.mm )
          .replace( `{ss}`, date.ss )
          .replace( Logger.colorsReg, (...match) => {
            const { color, data } = match[ match.length - 1 ]
            const text = data.replace( /\n     \| /g, `\n     ${Logger.colors[ mainColor ]}| ${Logger.colors[ color ]}` )

            return `${Logger.colors[ color ]}${text}${Logger.colors[ mainColor ]}`
          } )
        )
      }

      console.log( pattern, ...preparedItems )
    }
  }

  log( ...items ) {
    this.#logger( items )
  }

  /** Split the long one line to several shorter lines
   * @param {String} string
   * @param {Number} lineLength
   * @param {Number} firstLineLength
   */
  static split( string, lineLength, { firstSplitLen=lineLength, separateBreakBlock=false } ) {
    const lBrReg = /[- ,:;.]/
    const fL = separateBreakBlock ? lineLength : firstSplitLen
    const l = lineLength

    let cLL // current line length
    let chrsFrStart = 0

    for (let i = 0; chrsFrStart < string.length - (cLL = i == 0 ? fL : l); i++) {
      let retreat = 0

      while (retreat < 20 && !lBrReg.test( string[ chrsFrStart + cLL - retreat ] )) retreat++

      chrsFrStart = chrsFrStart + cLL - retreat

      switch (string[ chrsFrStart ]) {
        case ` `:
          string = `${string.slice( 0, chrsFrStart )}\n${string.slice( chrsFrStart + 1 )}`
          chrsFrStart++
          break

        case `,`:
        case `:`:
        case `;`:
        case `-`:
          string = `${string.slice( 0, chrsFrStart + 1 )}\n${string.slice( chrsFrStart + 1 )}`
          break

        case `.`:
        default:
          string = `${string.slice( 0, chrsFrStart )}\n${string.slice( chrsFrStart )}`
          break
      }
    }

    return (separateBreakBlock && (/\n/.test( string ) || string.length > firstSplitLen) ? `\n` : ``) + string
  }

  static getDate( locales=`en-GB`, date=Date.now() ) {
    const options = { year:`numeric`, month:'2-digit', day: '2-digit', hour:`2-digit`, minute:`2-digit`, second:`2-digit` }
    const [ { value:DD },,{ value:MM },,{ value:YYYY },,{ value:hh },,{ value:mm },,{ value:ss } ] = new Intl.DateTimeFormat( locales, options )
      .formatToParts( date )

    return { YYYY, MM, DD, hh, mm, ss }
  }
}

/** @type {Logger|null} */
let lastLogger = null

/**
 * @param {Logger} logger
 * @param {string[]} data
 */
export function logUnderControl( logger, ...data ) {
  if (!logger) return
  if (lastLogger && lastLogger !== logger && (lastLogger.isSeparated || logger.isSeparated)) {
    console.log( `` )
  }

  lastLogger = logger
  logger.log( ...data )
}