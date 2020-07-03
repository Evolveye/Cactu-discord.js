/** @typedef {"badParam"|"noCommand"|"noParam"|"noPath"|"noPerms"|"noPrefix"|"invalidCmd"} CommandErrorType */
/** @typedef {Object} CommandError
 * @property {CommandErrorType} type
 * @property {*} value
 * @property {RegExp|null} paramMask
*/

/** @typedef {("@nobody"|"@dm"|"@owner"|"@bot"|"@everyone")[]|string[]} Role */
/** @typedef {Object} Parameter
 * @property {string} param
 * @property {RegExp} mask
 * @property {boolean} optional
 */
/** @typedef {Object} CommandsField
 * @property {Role[]} roles
 * @property {string} desc
 * @property {Parameter[]} params
 * @property {function|Commands} value
 */
/** @typedef {Object<string,CommandsField} Commands */

export default class CommandProcessor {
  /** @type {string[]} */
  #parameters = []

  /** @type {Commands} */
  #commandsStructure = {}
  /** @type {Commands|CommandsField} */
  #scopeFromCommand = {}

  #prefixSpace = false
  #command = ``
  #prefix = ``
  #parts = { prev:``, part:``, rest:`` }
  #path = ``
  #isDm = false

  /** @type {CommandError} */
  #err = { type:null, value:null, paramMask:null }

  /**
   * @param {string} prefix
   * @param {string} message
   * @param {Commands>} commandsStructure
   */
  constructor( isDm, prefix, prefixSpace, message, commandsStructure ) {
    this.#commandsStructure = commandsStructure

    this.#prefixSpace = prefixSpace
    this.#command = message.trim()
    this.#prefix = prefix
    this.#parts = this.partCommand()
    this.#isDm = isDm

    this.#parts.rest = message.slice( prefix.length ).trim()
  }

  get commandsStructure() {
    return this.#commandsStructure
  }
  get prefixSpace() {
    return this.#prefixSpace
  }
  get parameters() {
    return this.#parameters
  }
  get command() {
    return this.#command
  }
  get prefix() {
    return this.#prefix
  }
  get parts() {
    return { ...this.#parts }
  }
  get path() {
    return this.#path
  }
  get err() {
    return { ...this.#err }
  }

  /**
   * @param {CommandErrorType} [type]
   * @param {*} [value]
   * @param {RegExp} [paramMask]
   */
  setError( type=null, value=null, paramMask=null ) {
    this.#err.type = type
    this.#err.value = value
    this.#err.paramMask = paramMask
  }

  nextPart() {
    this.#parts = this.partCommand( this.#parts.rest )

    return !!this.#parts.part
  }

  partCommand( command=`` ) {
    const { groups } = /^(?<part>\S+)(?: +(?<rest>[\s\S]*))?/.exec( command ) || { groups:{} }

    /** @type {string} */
    const prev = this.#parts ? `${this.#parts.prev} ${this.#parts.part}` : ``
    /** @type {string} */
    const part = groups.part || ``
    /** @type {string} */
    const rest = groups.rest || ``

    return { prev, part, rest }
  }

  checkPrefix() {
    const { command, prefix, prefixSpace } = this
    const firstWord = command.split( ` ` )[ 0 ]

    if (!command.startsWith( prefix )) this.setError( `noPrefix` )

    if (prefixSpace) {
      if (firstWord !== prefix) return this.setError( `noPrefix` )
    } else {
      if (firstWord !== command) return this.setError( `noPrefix` )
    }
  }

  /**
   * @param {function} roleTesterFunction
   */
  checkAccessToStructure( roleTesterFunction ) {
    if (this.err.type) return

    this.#scopeFromCommand = this.#commandsStructure

    /** @param {Role[]} roles */
    const checkAccess = roles => {
      if (roles.includes( `@nobody` )) return false
      if (this.#isDm) return roles.includes( `@dm` )
      if (roles.includes( `@everyone` )) return true

      return roleTesterFunction( roles )
    }

    while (this.nextPart()) {
      const { err, parts:{ part } } = this

      if (err.type) return

      if (!(part in this.#scopeFromCommand)) {
        return this.setError( `noPath`, this.command )
      }

      const structPart = this.#scopeFromCommand[ part ]

      if (!checkAccess( structPart.roles )) {
        return this.setError( `noPerms`, this.#command )
      }

      if (typeof structPart.value === `function`) {
        this.#scopeFromCommand = structPart

        return
      } else {
        this.#scopeFromCommand = structPart.value
      }
    }

    if (typeof this.#scopeFromCommand.value != `function`) {
      const value = {
        command: this.#command,
        structure: { ...this.#scopeFromCommand },
      }

      Object.keys( value.structure )
        .forEach( key => {
          value.structure[ key ] = { ...this.#scopeFromCommand[ key ] }

          /** @type {Role[]} */
          const scope = value.structure[ key ]

          if (!checkAccess( scope.roles )) delete value.structure[ key ]
          else {
            scope.type = typeof scope.value === `function` ? `command` : `scope`

            delete scope.value
          }
        } )

      this.setError( `noCommand`, value )
    }
  }

  validateParams() {
    if (this.err.type || typeof this.#scopeFromCommand.value != `function`) return

    const { params } = this.#scopeFromCommand
    const paramAdder = paramString => {
      if (paramString === ``) return

      const isParamValueNumber = paramString
        ? paramString.length < 10 && /^\d+(?:[\d_]*\d)?(?:\.\d+(?:[\d_]*\d)?)?(?:e\d+(?:[\d_]*\d)?)?$/.test( paramString )
        : false

      this.#parameters.push( isParamValueNumber
        ? Number( paramString.replace( /_/g, `` ) )
        : paramString
      )
    }

    let pasedParams = this.#parts.rest

    for (const { param, mask, optional } of params) {
      if (!mask.test( pasedParams )) {
        if (optional) {
          paramAdder( null )
          continue
        }
        return pasedParams
          ? this.setError( `badParam`, pasedParams.split( ` ` )[ 0 ], mask )
          : this.setError( `noParam`, param, mask )
      }

      const paramValue = mask.exec( pasedParams )[ 0 ] || null

      if (paramValue) {
        pasedParams = pasedParams.substr( paramValue.length ).trimLeft()

        paramAdder( paramValue )
      }
    }

    pasedParams.split( ` ` ).forEach( paramAdder )
  }

  execute() {
    if (this.err.type || typeof this.#scopeFromCommand.value != `function`) return

    try {
      this.#scopeFromCommand.value( ...this.#parameters )
    } catch (err) {
      this.setError( `invalidCmd`, err )
    }
  }

  /**
   * @param {boolean} prefixSpace
   * @param {function} roleTesterFunction
   * @param {function} [errorHandlerFunction]
   */
  process( roleTesterFunction, errorHandlerFunction=null ) {
    this.checkPrefix()
    this.checkAccessToStructure( roleTesterFunction )
    this.validateParams()
    this.execute()

    if (this.#err.type && errorHandlerFunction) errorHandlerFunction( this.err )
  }

  /**
   * @param {Commands} commands
   */
  static normalizeCommands( commands ) {
    const allAcceptableParams = [ `roles`, `desc`, `value`, `params` ]
    const checkField = (field, property, surrogate, defaultVal) => {
      if (surrogate in field) {
        let value = field[ surrogate ]

        if (Array.isArray( defaultVal ) && !Array.isArray( value )) {
          value = [ `${value}` ]
        }

        field[ property ] = value

        delete field[ surrogate ]
      } else if (!(property in field)) {
        field[ property ] = defaultVal
      }
    }

    for (const property in commands) {
      const field = commands[ property ]

      checkField( field, `roles`, `r`, [ `@everyone` ] )
      checkField( field, `desc`,  `d`, `` )
      checkField( field, `value`, `v` )

      if (typeof field.value === `function`) {
        checkField( field, `params`, `p`, this.funcData( field.value ) )
      } else this.normalizeCommands( field.value )

      Object.keys( field )
        .filter( key => !allAcceptableParams.includes( key ) )
        .forEach( key => delete field[ key ] )
    }
  }

  /**
   * @param {function} func
   */
  static funcData( func ) {
    const reg = {
      funcParter: /^(?<name>\S+) *\( *(?<params>[\s\S]*?) *\) *{ *(?<code>[\s\S]*)}$/,
      params: / *,? *(?<paramName>\w+) *= *\/(?<paramMask>.*?)\/(?<paramMaskFlags>\w*)?(?= *, *|$)/y,
    }

    const paramString = reg.funcParter.exec( func.toString() ).groups.params
    const params = []

    let paramData
    while (paramData = reg.params.exec( paramString )) {
      const { paramName, paramMask, paramMaskFlags } = paramData.groups

      params.push( {
        param: paramName,
        mask: new RegExp( `^${paramMask}`, `s` ),
        optional: /g/.test( paramMaskFlags ) || /^\.\*?$/.test( paramMask ),
        rest: /^\.(?:\+|\*)?$/.test( paramMask ),
      } )
    }

    return params
  }
}