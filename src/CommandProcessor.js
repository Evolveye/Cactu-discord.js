/** @typedef {import("discord.js").Channel} Channel */
/** @typedef {import("discord.js").Collection<Snowflake,MessageAttachment} Attachments */
/** @typedef {import("discord.js").MessageAttachment} MessageAttachment */
/** @typedef {import("discord.js").MessageOptions} MessageOptions */
/** @typedef {import("discord.js").MessageAdditions} MessageAdditions */
/** @typedef {import("discord.js").PermissionOverwriteOptions} PermissionOverwriteOptions */
/** @typedef {import("discord.js").Snowflake} Snowflake */

/**
 * @typedef {Object} ProcessedGuild
 * @property {Snowflake} id
 * @property {string} name
 * @property {() => Channel[]} getChannels
 * @property {(predicate:(channel:Channel) => boolean) => Channel} getChannel
 * @property {() => ProcessedUser[]} getMembers
 * @property {(predicate:(member:ProcessedUser) => boolean) => ProcessedUser} getMember
 */

/**
 * @typedef {Object} ProcessedChannel
 * @property {Snowflake} id
 * @property {string} name
 * @property {ProcessedGuild} guild
 * @property {(message:string) => void} send
 * @property {(message:MessageOptions|MessageAdditions) => Promise<ProcessedMessage>} sendEmbeded
 * @property {(userOrRoleId:Snowflake options:PermissionOverwriteOptions) => Promise<>} updatePermissions
 */

/**
 * @typedef {Object} ProcessedUser
 * @property {Snowflake} id
 * @property {(id:Snowflake) => void} setRole
 * @property {string} displayName
 * @property {string} name
 * @property {string} mention
 */

/**
 * @typedef {Object} ProcessedMessage
 * @property {string} content
 * @property {Snowflake} id
 * @property {() => voic} delete
 * @property {ProcessedUser} author
 * @property {ProcessedChannel} channel
 * @property {ProcessedGuild} guild
 * @property {Attachments} attachments
 */

/**
 * @typedef {Object} Variables
 * @property {ProcessedMessage} message
 * @property {(message:string) => Promise<ProcessedMessage>} sendOk
 * @property {(message:string) => Promise<ProcessedMessage>} sendErr
 */

/** @typedef {"@bot_owner" | "@dm" | "@server_admin" | "@bot" | "@<user id>" | "<role name or ID>"} PermissionInstance */
/** @typedef {"@everyone" | PermissionInstance | PermissionInstance[]} Permission */

/**
 * @typedef {Object} CommandsObjectMetadata
 * @property {Permission} r Shortcut for `roles`. Names or IDs of roles which can use it. It can be any string
 * @property {Permission} roles Names or IDs of roles which can use it. It can be any string
 * @property {string} d Shortcut for `description`
 * @property {string} description Just a description
 * @property {string} sd Shortcut for `shortDescription`. Short version of the description (a few words)
 * @property {string} shortDescription Short version of the description (a few words)
 */

/** @typedef {Object<string,Scope|Function>} CommandsObjectData */

/** @typedef {"badParam"|"details"|"scope"|"noParam"|"noPath"|"noPerms"|"noPrefix"|"invalidCmd"} CommandMetaType */
/**
 * @typedef {Object} CommandState
 * @property {CommandMetaType} type
 * @property {*} value
 * @property {RegExp|null} paramMask
*/

/** @typedef {("@dm"|"@owner"|"@bot"|"@everyone")[]|string[]} Role */
/**
 * @typedef {Object} Parameter
 * @property {string} param
 * @property {RegExp} mask
 * @property {boolean} optional
 */
/**
 * @typedef {Object} CommandsField
 * @property {Role[]} roles
 * @property {string} desc
 * @property {Parameter[]} params
 * @property {function|Commands} value
 */
/** @typedef {Object<string,CommandsField} Commands */



class CommandElement {
  /**
   * @param {CommandsObjectMetadata} param0
   */
  constructor({ r, roles = r, d, description = d, sd, shortDescription = sd }) {
    this.roles            = roles            || `@everyone`
    this.description      = description      || shortDescription
    this.shortDescription = shortDescription || this.description
  }


  /**
   * @param {CommandsObjectMetadata} param0
   */
  updateMeta({ r = ``, roles = r, d = ``, description = d, sd = ``, shortDescription = sd }) {
    if (roles)            this.roles            = typeof roles === `string` ? roles : roles.slice( 0 )
    if (description)      this.description      = description
    if (shortDescription) this.shortDescription = shortDescription
  }


  getMeta() {
    return {
      roles: this.roles,
      description: this.description,
      shortDescription: this.shortDescription,
    }
  }
}

export class Scope extends CommandElement {
  /**
   * @param {CommandsObjectMetadata} meta
   * @param {CommandsObjectData} data
   */
  constructor( meta, data ) {
    super( meta )

    this.structure = data
  }


  setSafety( isSafe ) {
    Scope.setSafety( this, isSafe )
  }


  /**
   * @param {Scope} scope
   * @param {boolean} override
   */
  merge( scope, override = false ) {
    Scope.merge( this, scope, override )
  }


  serialize( onlyUnsafe = true ) {
    return Scope.getData( this, { onlyUnsafe, meta:true, serialized:true } )
  }


  getData( { onlyUnsafe = false, meta = true, serialized = true } = {} ) {
    return Scope.getData( this, { onlyUnsafe, meta, serialized } )
  }


  static setSafety( scope, isSafe ) {
    for (const prop in scope.structure) {
      const field = scope.structure[ prop ]

      if (field instanceof Command) field.setSafety( isSafe )
      else if (field instanceof Scope) this.setSafety( field, isSafe )
    }
  }


  /**
   * @param {Scope} targetScope
   * @param {Scope} scope
   * @param {boolean} override
   */
  static merge( targetScope, scope, override ) {
    if (override) targetScope.updateMeta( scope )

    for (const prop in scope.structure) {
      const field = scope.structure[ prop ]

      if (prop in targetScope.structure && !override) continue

      if (field instanceof Command) targetScope.structure[ prop ] = field
      else if (field instanceof Scope) {
        if (!(prop in targetScope.structure)) targetScope.structure[ prop ] = new Scope( {}, {} )

        this.merge( targetScope.structure[ prop ], field, override )
      }
    }
  }


  /**
   * @param {Scope} scope
   * @param {boolean} onlyUnsafe
   */
  static getData( scope, { serialized = false, ...restOfConfig } ) {
    const data = this.#dataGetterHelper( scope, restOfConfig )

    return serialized ? JSON.stringify( data ) : data
  }


  /**
   * @param {Scope} scope
   * @param {boolean} onlyUnsafe
   */
  static #dataGetterHelper( scope, { onlyUnsafe = false, meta = false } ) {
    const result = {
      type: `scope`,
      ...(meta ? scope.getMeta() : {}),
      structure: {},
    }

    Object.entries( scope.structure ).map( ([ key, value ]) => {
      if (value instanceof Command) {
        if (onlyUnsafe && value.safe) return

        result.structure[ key ] = {
          type: `command`,
          ...(meta ? scope.getMeta() : {}),
          code: value.code,
        }
      } else if (value instanceof Scope) {
        const nestedScope = this.#dataGetterHelper( value, { onlyUnsafe, meta } )

        if (Object.keys( nestedScope.structure ).length) result.structure[ key ] = nestedScope
      }
    } )

    return result
  }
}

export class Executor extends CommandElement {
  safe = true


  /**
   * @param {CommandsObjectMetadata} meta
   * @param {($:Variables, ...rest) => void|boolean|string} fn
   */
  constructor( meta, fn ) {
    super( meta )

    this.trigger = fn

    const { params, code } = Executor.extractCommandData( fn )
    this.params = params.slice( 1 )
    this.code = code
  }


  setSafety( isSafe ) {
    this.safe = isSafe
  }


  /**
   * @param {Command} command
   */
  static extractCommandData( command ) {
    const reg = {
      isItArrowFunction: /(?<params>[\s\S]*?) *=>/,

      funcParter: /^(?<name>\S+) *\( *(?<paramsStr>[\s\S]*?) *\) *{ *(?<code>[\s\S]*)}$/,
      arrowParter: /^\(? *(?<paramsStr>[\s\S]*?) *\)? *=> *{? *(?<code>[\s\S]*?)}?$/,

      // params: / *,? *(?<paramName>\$|\w+)(?: *= *\/(?<paramMask>.*?)\/(?<paramMaskFlags>\w*)?(?= *, *|$))?/y,
      params: / *,? *(?<name>\$|\w+)(?: *= *(?<value>.*?)(?= *, *|$))?/y,
      regExp: /\/(?<mask>.*?)\/(?<flags>\w*)?/,
    }

    const commandString = command.toString()
    const parterReg = reg.isItArrowFunction.test( commandString ) ? reg.arrowParter : reg.funcParter
    const { paramsStr, code } = parterReg.exec( commandString ).groups
    const params = []

    for (let paramData;  (paramData = reg.params.exec( paramsStr ));) {
      const { name, value } = paramData.groups
      let mask = /\S+/
      let optional = false
      let rest = false

      if (value) {
        if (reg.regExp.test( value )) {
          const regExp = reg.regExp.exec( value )?.groups ?? {}

          if (regExp.mask) mask = new RegExp( `^${regExp.mask}`, `s` )
          if (/g/.test( regExp.flags )) optional = true
        } else if (/^(`|'|").*(`|'|")$/.test( value )) {
          const stringValue = /^(?:`|'|")(.*)(?:`|'|")$/.exec( value )[ 1 ]

          switch (stringValue) {
            case `...`: optional = true
            case `!!!`:
              rest = true
              break
          }
        }
      }

      params.push({ name, mask, optional, rest })
    }

    return { params, code }
  }
}



class Command {
  #trigger
  #prefix
  #prefixSpace
  #parameters = []
  #parametersData = { fail:{ param:null, mask:null }, string:`` }
  #parts = { previous:``, current:``, rest:`` }
  #deeperPermittedToSeeCommandElements = []

  /** @type {null|Executor} */
  #foundExecutor = null

  /** @type {CommandState} */
  #state = { type:null, value:null, paramMask:null }



  get trigger() {
    return this.#trigger
  }
  get prefix() {
    return this.#prefix
  }
  get prefixSpace() {
    return this.#prefixSpace
  }
  get currentlyCheckedPath() {
    return `${this.#parts.previous} ${this.#parts.current}`
  }
  get parameters() {
    return this.#parameters
  }
  get state() {
    return this.#state.type ? { ...this.#state } : null
  }


  /** @param {string} trigger */
  constructor( trigger, prefix, prefixSpace ) {
    this.#trigger = trigger
    this.#prefix = prefix
    this.#prefixSpace = prefixSpace

    this.#partCommand( trigger )
  }


  #makeNextPart() {
    this.#partCommand()

    return !!this.#parts.current
  }


  #partCommand( command = this.#parts.rest ) {
    const parts = this.#parts
    const { groups } = /^(?<current>\S+)(?: +(?<rest>[\s\S]*))?/.exec( command ) ?? { groups:{} }

    parts.previous = `${parts.previous} ${parts.current}`
    parts.current = groups.current ?? ``
    parts.rest = groups.rest ?? ``
  }


  #partParameters({ name, mask, optional }) {
    const parts = this.#parametersData
    const paramsString = parts.string
    const setFail = (param, mask) => {
      parts.fail.param = param
      parts.fail.mask = mask
    }

    if (!mask.test( paramsString )) {
      if (optional) {
        this.#paramAdder()
        return true
      }

      if (paramsString) {
        setFail( paramsString.split( ` ` )[ 0 ], mask )
        return this.#setState( `badParam` )
      } else {
        setFail( name, mask )
        return this.#setState( `noParam` )
      }
    }

    const paramValue = mask.exec( paramsString )[ 0 ] ?? null

    if (paramValue) {
      parts.string = paramsString.substr( paramValue.length ).trim()
      this.#paramAdder( paramValue, mask )
    }
  }


  #paramAdder = paramString => {
    if (paramString === ``) return

    const isParamValueNumber = paramString
      ? paramString.length < 10 && /^-?\d+(?:[\d_]*\d)?(?:\.\d+(?:[\d_]*\d)?)?(?:e\d+(?:[\d_]*\d)?)?$/.test( paramString )
      : false

    this.#parameters.push( isParamValueNumber
      ? Number( paramString.replace( /_/g, `` ) )
      : paramString,
    )
  }


  /** @param {CommandMetaType} [type] */
  #setState( type ) {
    const setIt = (value = null, mask = null) => {
      this.#state.type = type
      this.#state.value = value
      this.#state.paramMask = mask

      return this.state
    }

    switch (type) {
      case `noPrefix`: return setIt( this.prefix )
      case `noPath`: return setIt( this.currentlyCheckedPath )
      case `scope`: return setIt( this.#deeperPermittedToSeeCommandElements )
      case `noParam`: return setIt( this.#parametersData.fail )
      case `badParam`: return setIt( this.#parametersData.fail )
      case `noPerms`: return setIt( this.currentlyCheckedPath )
      case `tooManyParams`: return setIt( this.#parametersData.string.split( ` ` )[ 0 ] )
      case `readyToExecute`: return setIt( this.#parameters )
      case `details`: return setIt({
        command: this.currentlyCheckedPath,
        ...this.#foundExecutor.getMeta(),
        params: this.#foundExecutor.params,
      })

      default:
        console.warn( `unknown state` )
        break
    }
  }


  checkPrefix() {
    if (this.state) return this.state

    const { prefix, trigger, prefixSpace } = this
    const firstWord = trigger.split( ` ` )[ 0 ]

    if (!trigger.startsWith( prefix )) return this.#setState( `noPrefix` )

    if (prefixSpace) {
      if (firstWord !== prefix) return this.#setState( `noPrefix` )
    } else {
      if (firstWord !== trigger) return this.#setState( `noPrefix` )
    }

    return true
  }


  /**
   * @param {Scope} scope
   * @param {function} checkPermissions
   */
  checkAccessToScope( scope, checkPermissions ) {
    if (this.state) return this.state

    /** @param {Permission} roles */
    const checkAccess = roles => {
      if (roles.includes( `@everyone` )) return true

      return checkPermissions( roles )
    }

    let deeperPermittedCommandElement = scope

    while (this.#makeNextPart()) {
      if (this.state) return

      const currentPart = this.#parts.current

      if (!(currentPart in scope.structure)) return this.#setState( `noPath` )

      const subScope = scope.structure[ currentPart ]

      if (!checkAccess( subScope.roles )) return this.#setState( `noPerms` )

      deeperPermittedCommandElement = subScope

      if (subScope instanceof Executor) break
    }

    if (deeperPermittedCommandElement instanceof Executor) {
      return this.#foundExecutor = deeperPermittedCommandElement
    }

    const structure = { ...deeperPermittedCommandElement.structure }
    const elements = []

    Object.keys( structure ).forEach( key => {
      const cmdElement = structure[ key ]

      if (!checkAccess( cmdElement.roles )) return

      const meta = cmdElement.getMeta()

      if (cmdElement instanceof Executor) meta.params = cmdElement.params

      elements.push({
        name: `${this.#parts.previous} ${key}`,
        meta,
        type: cmdElement instanceof Scope ? `scope` : `executor`,
      })
    } )

    this.#deeperPermittedToSeeCommandElements.push( ...elements )

    return this.#setState( `scope` )
  }


  validateParams() {
    if (this.state || !(this.#foundExecutor instanceof Executor)) return

    const executor = this.#foundExecutor

    this.#parametersData.string = this.#parts.rest

    if (this.#parametersData.string === `??`) {
      return this.#setState( `details`, {
        command: this.currentlyCheckedPath,
        description: executor.description,
        params: executor.params,
      } )
    } else for (const param of executor.params) {
      this.#partParameters( param )

      if (this.state) return
    }

    if (this.#parametersData.string.length) {
      this.#setState( `tooManyParams` )
    } else {
      this.#setState( `readyToExecute` )
    }
  }


  /** @param {(commandMeta:CommandState) => void} [handleState] */
  execute( handleState ) {
    if (this.state) return handleState?.( this.state )

    try {
      console.log( this.#foundExecutor, this.#parameters ) // .( ...this.#parameters )
    } catch (err) {
      // this.setError( `invalidCmd`, err )
    }
  }
}

export default class CommandProcessor {
  /** @type {Commands} */
  #commandsStructure = {}

  #prefixSpace = false
  #prefix = ``


  get commandsStructure() {
    return this.#commandsStructure
  }
  get prefixSpace() {
    return this.#prefixSpace
  }
  get prefix() {
    return this.#prefix
  }


  /**
   * @param {string} prefix
   * @param {string} message
   * @param {Commands>} commandsStructure
   */
  constructor( prefix = ``, prefixSpace = true, commandsStructure = null ) {
    this.#commandsStructure = commandsStructure
    this.#prefixSpace = prefixSpace
    this.#prefix = prefix
  }


  /** @param {string} prefix */
  setPrefix( prefix ) {
    this.#prefix = prefix
  }


  /** @param {boolean} prefixSpace */
  setPrefixSpace( prefixSpace ) {
    this.#prefixSpace = prefixSpace
  }


  /** @param {Scope} scope */
  setCommandsStructure( scope ) {
    this.#commandsStructure = scope
  }


  /**
   * @param {boolean} prefixSpace
   * @param {(roles:Role[] botOperatorId:string) => boolean} checkPermissions
   * @param {(commandMeta:CommandState) => void} handleState
   */
  process( commandTrigger, checkPermissions ) {
    if (!this.#commandsStructure) return

    const command = new Command( commandTrigger, this.prefix, this.prefixSpace )

    command.checkPrefix()
    command.checkAccessToScope( this.#commandsStructure, checkPermissions )
    command.validateParams()

    return command.state
  }


  /** @param {Commands} commands */
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


  /** @param {function} func */
  static funcData( func ) {
    const reg = {
      funcParter: /^(?<name>\S+) *\( *(?<params>[\s\S]*?) *\) *{ *(?<code>[\s\S]*)}$/,
      params: / *,? *(?<paramName>\w+) *= *\/(?<paramMask>.*?)\/(?<paramMaskFlags>\w*)?(?= *, *|$)/y,
    }

    const paramString = reg.funcParter.exec( func.toString() ).groups.params
    const params = []

    let paramData
    while ((paramData = reg.params.exec( paramString )) ) {
      const { paramName, paramMask, paramMaskFlags } = paramData.groups

      params.push({
        param: paramName,
        mask: new RegExp( `^${paramMask}`, `s` ),
        optional: /g/.test( paramMaskFlags ) || /^\.\*?$/.test( paramMask ),
        rest: /^\.(?:\+|\*)?$/.test( paramMask ),
      })
    }

    return params
  }
}
