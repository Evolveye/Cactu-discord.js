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

      console.log( `"${paramString}"` )

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

Commands.predefinedCommands = {
  $: {
    load( r='Owner', p={ what:/c|commands|f|filters/ }, d='Load commands/filters from attached file' ) {
      const attachment = $.message.attachments.first() || {}
      const guildId = $.message.guild.id
      let reg

      if ([ 'c', 'commands' ].includes( what )) {
        what = 'commands'
        reg = /^.*?(\( *{[\s\S]*structure *: *{[\s\S]*} *\))$/s
      } else {
        what = 'filters'
        reg = /^.*?(\[[ \r\n]*{[\s\S]+}[ \r\n]*])$/s
      }

      if (attachment.url && !attachment.width) {
        const extension = attachment.filename.match( /.*\.([a-z]+)/ )[ 1 ] || 'mjs'
        const fileName = `${fs.realpathSync( '.' )}/guilds_config/${guildId}-${what}.${extension}`
        const file = fs.createWriteStream( fileName )

        https.get( attachment.url, res => {
          res.pipe( file ).on( 'finish', () => {
            file.close()

            const { guildData } = $
            const cmdsInstance = guildData.commands

            let object = fs.readFileSync( fileName, 'utf8' )

            try {
              if (!reg.test( object )) throw ''

              object = eval( object.match( reg )[ 1 ] )

              if (what === 'commands') {

                cmdsInstance.structure = Commands.build( Commands.cloneObjects( object.structure, Commands.predefinedCommands ) )
                cmdsInstance.setLang( object.myLang )

                Object.keys( object )
                  .filter( key => key.startsWith( 'on' ) )
                  .forEach( key => this.events[ key.charAt( 2 ).toLowerCase() + key.slice( 3 ) ] = configObject[ key ] )
              } else guildData.filters.setFilters( object )

              $.sendStatus( cmdsInstance.lang.$_loadSucces )
            } catch (err) {
              $.sendStatus( `${cmdsInstance.lang.$_loadFail}\n\n${err}`, 'error' )
              fs.unlink( fileName, () => {} )
            }
          } )
        } )
      }
    },
    botOperator( r='Owner', p={ roleName:'???' }, d='Set the role which will have owner permissions for bot' ) {
      if (!roleName) return $.bot.botOperatorId = null

      const role = $.message.guild.roles.find( r => r.name === role )

      if (role) {
        $.bot.botOperatorId = role.id
        $.sendStatus( 'Bot operator has been setted successfully' )
      } else throw "That role doesn't exists"
    },
    getConfigFile( r=`Owner`, p={ what:/c|commands|f|filters/ }, d=`Get file with commands or filters` ) {
      let configFileName = `${fs.realpathSync( '.' )}/guilds_config/${m.guild.id}-${/c|commands/.test( what ) ? 'commands' : 'filters'}`

      if (fs.existsSync( `${configFileName}.js` )) configFileName += '.js'
      else if (fs.existsSync( `${configFileName}.mjs` )) configFileName += '.mjs'
      else throw "That guild doesn't have the config file"

      m.channel.send( { files:[ configFileName ] } )
    },
    upload( r='Owner', d='Upload attached file' ) {
      const attachment = $.message.attachments.first() || {}
      const guildId = $.message.guild.id

      if (!attachment.url) throw `No attached file`

      const fileName = `${fs.realpathSync( '.' )}/guilds_config/${guildId}-${fileName}`
      const file = fs.createWriteStream( fileName )

      https.get( attachment.url, res => {
        res.pipe( file ).on( 'finish', () => {
          file.close()

          $.sendStatus( `Done` )
        } )
      } )
    },
  }
}