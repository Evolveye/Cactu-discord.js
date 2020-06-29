/** @typedef {"badParam"|"noCommand"|"noParam"|"noPerms"|"noPrefix"} CommandErrorType */
/** @typedef {Object} CommandError
 * @property {CommandErrorType} type
 * @property {*} value
 * @property {RegExp|null} paramMask
*/

export default class CommandProcessor {
  /** @type {string[]} */
  #parameters = []

  /** @type {GuildModuleCommands} */
  #commandsStructure = {}
  /** @type {GuildModuleCommands|GuildModuleCommandsField} */
  #scopeFromCommand = {}

  #command = ``
  #prefix = ``
  #parts = { prev:``, part:``, rest:`` }
  #path = ''
  #isDm = false

  /** @type {CommandError} */
  #err = { type:null, value:null, paramMask:null }

  /**
   * @param {string} prefix
   * @param {string} message
   * @param {GuildModuleCommands>} commandsStructure
   */
  constructor( isDm, prefix, message, commandsStructure ) {
    this.#commandsStructure = commandsStructure

    this.#command = message.trim()
    this.#parts = this.partCommand()
    this.#prefix = prefix
    this.#isDm = isDm

    this.#parts.rest = message.slice( prefix.length ).trim()
  }

  get commandsStructure() {
    return this.#commandsStructure
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

  partCommand( command='' ) {
    const { groups } = /^(?<part>\S+)(?: +(?<rest>[\s\S]*))?/.exec( command ) || { groups:{} }

    /** @type {string} */
    const prev = this.#parts ? `${this.#parts.prev} ${this.#parts.part}` : ``
    /** @type {string} */
    const part = groups.part || ''
    /** @type {string} */
    const rest = groups.rest || ''

    return { prev, part, rest }
  }

  checkPrefix( prefixSpace=true ) {
    const { command, prefix } = this
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
    this.#scopeFromCommand = this.#commandsStructure
    /** @param {GuildModuleRoles} roles */
    const checkAccess = roles => {
      if (roles.includes( `@nobody` )) return false
      if (this.#isDm) return roles.includes( `@dm` )
      if (roles.includes( `@everyone` )) return true

      return roleTesterFunction( roles )
    }

    if (!this.err.type) while (this.nextPart()) {
      const { err, parts:{ part } } = this

      if (err.type) return

      if (!(part in this.#scopeFromCommand)) {
        return this.setError( `noCommand`, this.command )
      }

      const structPart = this.#scopeFromCommand[ part ]

      if (!checkAccess( structPart.roles )) {
        return this.setError( `noPerms` )
      }

      if (typeof structPart.value === `function`) {
        this.#scopeFromCommand = structPart

        return
      } else {
        this.#scopeFromCommand = structPart.value
      }
    }
  }

  validateParams() {
    if (this.err.type || typeof this.#scopeFromCommand.value != `function`) return

    const { masks } = this.#scopeFromCommand
    const paramAdder = paramString => {
      if (!paramString) return

      const isParamValueNumber = /\d+(?:[\d_]*\d)?(?:\.\d+(?:[\d_]*\d)?)?(?:e\d+(?:[\d_]*\d)?)?/.test( paramString )

      this.#parameters.push( isParamValueNumber
        ? Number( paramString.replace( /_/g, `` ) )
        : paramString
      )
    }

    let params = this.#parts.rest

    for (const mask of masks) {
      if (!mask.test( params )) {
        if (!params) {
          const commandFunc = this.#scopeFromCommand.value
          const paramNames = CommandProcessor.funcData( commandFunc )

          this.setError( `noParam`, paramNames[ masks.indexOf( mask ) ], mask )
        } else {
          this.setError( `badParam`, params.split( ` ` )[ 0 ]  ||  ` 👈`, mask )
        }

        return
      }

      const paramValue = mask.exec( params )[ 0 ] || null

      if (paramValue){
        params = params.substr( paramValue.length ).trimLeft()

        paramAdder( paramValue )
      }
    }

    params.split( ` ` ).forEach( paramAdder )
  }

  execute() {
    if (this.err.type || typeof this.#scopeFromCommand.value != `function`) return

    this.#scopeFromCommand.value( ...this.#parameters )
  }

  /**
   * @param {boolean} prefixSpace
   * @param {function} roleTesterFunction
   * @param {function} [errorHandlerFunction]
   */
  process( prefixSpace, roleTesterFunction, errorHandlerFunction=null ) {
    this.checkPrefix( prefixSpace )
    this.checkAccessToStructure( roleTesterFunction )
    this.validateParams()
    this.execute()

    if (this.#err.type && errorHandlerFunction) errorHandlerFunction( this.err )
  }

  /**
   * @param {function} func
   */
  static funcData( func ) {
    const reg = {
      funcParter: /^(?<name>\S+) *\( *(?<params>[\s\S]*?) *\) *{ *(?<code>[\s\S]*)}$/,
      params: /\w+ *(?:= *.+?)?(?=, *|$)/g
    }

    const { params } = reg.funcParter.exec( func.toString() ).groups
    const paramNames = params.match( reg.params ) || []

    return paramNames
  }
}