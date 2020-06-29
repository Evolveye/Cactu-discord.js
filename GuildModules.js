/** @typedef {Object<string,string>} GuildModuleTranslation */
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
/** @typedef {Object<string,string>} Variables */

export default class GuildModules {
  /** @type {GuildModuleTranslation} */
  translation = {}
  /** @type {GuildModuleFilters} */
  filters = {}
  /** @type {GuildModuleCommands} */
  commands = {}
  /** @type {string} */
  botOperatorId = ``
  /** @type {Variables} */
  variables = {}

  constructor() {
    this.include( GuildModules.predefinedCommands )
  }

  /**
   * @param {GuildModule} param0
   */
  include( module ) {
    const { translation={}, commands={}, filters={}, botOperatorId={} } = typeof module === `function`
      ? module( this.variables )
      : module

    this.normalizeCommands( commands )

    console.log( `\n######\n`, this.commands, commands )

    GuildModules.safeCommandsAssign( this.commands, commands )
    this.translation = Object.assign( translation, this.translation )
    this.filters = Object.assign( filters, this.filters )
    this.botOperatorId = botOperatorId

    console.log( `####\n`, this.commands )
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
}

/** @param {Variables} $ */
GuildModules.predefinedCommands = $ => ({
  translation: {
    text: `translation`,
  },
  filters: {
    [/filter mask 1/]() {
      // code
    },
    [/filter mask 1/]() {
      // code
    },
  },
  commands: {
    // d == desc
    // r == roles
    // m == masks
    // v == value

    $: { d:`Bot administration`, r:`@owner`, v:{
      load: { d:`Load commands/filters from attached file`, m:[ /c|commands|f|filters/ ], v( what ) {
        const { message } = $

        console.log( what, message ? message.content : null )
      }},
    }},
  },
})