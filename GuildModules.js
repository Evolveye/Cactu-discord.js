/** @typedef {Object} GuildModuleTranslation
 * @property {string} err_badParam
 * @property {string} err_noCommand
 * @property {string} err_noParam
 * @property {string} err_noPath
 * @property {string} err_noPerms
 * @property {string} err_noPrefix
 * @property {string} err_invalidCmd
 * @property {string} help_title
 * @property {string} help_showMasks
 * @property {string} help_params
 * @property {string} help_masks
 * @property {string} footer_yourCmds
 * @property {string} footer_cmdInfo
 * @property {string} system_loadSucc
 * @property {string} system_loadFail
 */
/** @typedef {Object<string,function>} GuildModuleFilters */
/** @typedef {("@nobody"|"@dm"|"@owner"|"@bot"|"@everyone")[]|string[]} GuildModuleRoles */
/** @typedef {Object} GuildModuleCommandsField
 * @property {GuildModuleRoles} roles
 * @property {string} desc
 * @property {RegExp[]} masks
 * @property {function|GuildModuleCommands} value
 */
/** @typedef {Object<string,GuildModuleCommandsField} GuildModuleCommands */
/** @typedef {Object} GuildModule
 * @property {GuildModuleTranslation} translation
 * @property {GuildModuleFilters} filters
 * @property {GuildModuleCommands} commands
 */
/** @typedef {import("discord.js").Message} SafeVariables */
/** @typedef {Object} UnsafeVariables
 * @property {import("discord.js").Message} message
 * @property {import("./index.js").default} botInstance
 */

export default class GuildModules {
  /** @type {GuildModuleTranslation} */
  translation = {
    err_badParam:     `Not valid parameter!`,
    err_noCommand:    `This is scope, not a command!`,
    err_noParam:      `Required parameters weren't passed!`,
    err_noPath:       `Command doesn't exists`,
    err_noPerms:      `You don't have permissions to use that!`,
    err_noPrefix:     `You didn't pass the prefix`,
    err_invalidCmd:   `That command have invalid code!`,
    help_title:       `Help for a syntax of the specified command`,
    help_showMasks:   `Send **!!** as first parameter of command to show description and params syntax`,
    help_params:      `The X**?** means optional parameter and the **...**X means any string`,
    help_masks:       `If you don't know what is going on, you can ask somebody from server stuff, or you can check "masks" on`,
    footer_yourCmds:  `These are your personalized commands after sending:`,
    footer_cmdInfo:   `Commands information`,
    system_loadSucc:  `File has been loaded`,
    system_loadFail:  `Wrong file data!`
  }
  /** @type {GuildModuleFilters} */
  filters = {}
  /** @type {GuildModuleCommands} */
  commands = {}
  /** @type {Discord} */
  botOperatorId = ``
  /** @type {SafeVariables} */
  unsafeVariables = {}
  /** @type {UnsafeVariables} */
  safeVariables = {}

  constructor() {
    this.include( GuildModules.predefinedCommands )
  }

  /**
   * @param {GuildModule} param0
   */
  include( module ) {
    const { translation={}, commands={}, filters={}, botOperatorId={} } = typeof module === `function`
      ? module( this.unsafeVariables )
      : module

    this.normalizeCommands( commands )

    GuildModules.safeCommandsAssign( this.commands, commands )
    this.translation = Object.assign( translation, this.translation )
    this.filters = Object.assign( filters, this.filters )
    this.botOperatorId = botOperatorId
  }

  /**
   * @param {GuildModuleCommands} commands
   */
  normalizeCommands( commands ) {
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

      if (typeof field.value === `function`) checkField( field, `masks`, `m`, [] )
      else this.normalizeCommands( field.value )
    }
  }

  /**
   * @param {import("discord.js").Message} message
   */
  setSafeVariables( message ) {
    if (!message) throw new Error( `All parameters are required!` )

    delete message.application
    GuildModules.deletePropertyGlobaly( message, `client`, 2 )

    this.safeVariables.message = message
  }

  /**
   * @param {import("discord.js").Message} message
   * @param {import("./index.js").default} botInstance
   */
  setUnsafeVariables( message, botInstance ) {
    if (!message || !botInstance) throw new Error( `All parameters are required!` )

    this.unsafeVariables.message = message
    this.unsafeVariables.botInstance = botInstance
  }

  /**
   * @param {import("discord.js").Message} message
   * @param {import("./index.js").default} botInstance
   */
  setVariables( message, botInstance ) {
    this.setSafeVariables( message )
    this.setUnsafeVariables( message, botInstance )
  }

  /**
   * @param {Object<string,*>} target
   * @param {Object<string,*>} object
   */
  static safeCommandsAssign( target, object ) {
    Object.keys( object ).forEach( key => {
      switch (typeof object[ key ]) {
        case `object`:
          if (Array.isArray( object[ key ] )) {
            if (key != `masks` || !(key in target)) target[ key ] = object[ key ]
          } else target[ key ] = this.safeCommandsAssign( target[ key ] || {}, object[ key ] )
          break

        case `function`:
          if (key in target) break

        default: target[ key ] = object[ key ]
      }
    } )

    return target
  }

  /**
   * @param {Object<string,*>} object
   * @param {string} property
   */
  static deletePropertyGlobaly( object, property, maxDeep=Infinity ) {
    const references = []
    const deletePropG = (object, deep=0) => Object.keys( object ).forEach( key => {
      const prop = object[ key ]

      if ((deep === maxDeep && Object( prop ) !== prop) || key === property) delete object[ key ]
      else if (typeof prop == `object` && !Array.isArray( prop ) && references.includes( prop )) {
        references.push( prop )
        deletePropG( prop, deep + 1 )
      }
    } )
  }
}

/** @param {UnsafeVariables} $ */
GuildModules.predefinedCommands = $ => ({ commands: {
  $: { d:`Bot administration`, r:`@owner`, v:{
    load: { d:`Load commands/filters from attached file`, m:[ /c|commands|f|filters/ ], v( what ) {
      const { message } = $

      console.log( what, message )
    }},
  }},
} })