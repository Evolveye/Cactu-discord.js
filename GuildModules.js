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

export default class GuildModules {
  /**
   * @param {GuildModuleTranslation} translation
   * @param {GuildModuleFilters} filters
   * @param {GuildModuleCommands} commands
   */
  constructor( translation={}, filters={}, commands={}, botOperatorId=`` ) {
    this.translation = translation
    this.filters = filters
    this.command = commands
    this.botOperatorId = botOperatorId
  }

  /**
   * @param {GuildModule} param0
   */
  include( { translation={}, filters={}, commands={}, botOperatorId=`` } ) {
    this.normalizeCommands( commands )

    this.translation = Object.assign( translation, this.translation )
    this.commands = Object.assign( commands, this.commands )
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
}