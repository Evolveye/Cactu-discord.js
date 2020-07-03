import CommandProcessor from "./CommandProcessor.js"
import fs from "fs"
import https from "https"

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
 * @property {string} help_cmds
 * @property {string} help_scopes
 * @property {string} footer_yourCmds
 * @property {string} footer_cmdInfo
 * @property {string} system_loadSucc
 * @property {string} system_loadFail
 */

/** @typedef {{regExp:RegExp,func:function}[][]} GuildModuleFilters */

/** @typedef {import("./CommandProcessor.js").Commands} GuildModuleCommands */
/** @typedef {import("./CommandProcessor.js").CommandsField} GuildModuleCommandsField */

/** @typedef {Object} Events For details look at Events on https://discord.js.org/#/docs/main/stable/class/Client
 * @property {function} [channelCreate]
 * @property {function} [channelDelete]
 * @property {function} [channelPinsUpdate]
 * @property {function} [channelUpdate]
 * @property {function} [clientUserGuildSettingsUpdate]
 * @property {function} [clientUserSettingsUpdate]
 * @property {function} [debug]
 * @property {function} [disconnect]
 * @property {function} [emojiCreate]
 * @property {function} [emojiDelete]
 * @property {function} [emojiUpdate]
 * @property {function} [error]
 * @property {function} [guildBanAdd]
 * @property {function} [guildBanRemove]
 * @property {function} [guildCreate]
 * @property {function} [guildDelete]
 * @property {function} [guildMemberAdd]
 * @property {function} [guildMemberAvailable]
 * @property {function} [guildMemberRemove]
 * @property {function} [guildMembersChunk]
 * @property {function} [guildMemberSpeaking]
 * @property {function} [guildMemberUpdate]
 * @property {function} [guildUnavailable]
 * @property {function} [guildUpdate]
 * @property {function} [guildIntegrationsUpdate]
 * @property {function} [inviteCreate]
 * @property {function} [message]
 * @property {function} [messageDelete]
 * @property {function} [messageDeleteBulk]
 * @property {function} [messageReactionAdd]
 * @property {function} [messageReactionRemove]
 * @property {function} [messageReactionRemoveEmoji]
 * @property {function} [messageReactionRemoveAll]
 * @property {function} [messageUpdate]
 * @property {function} [presenceUpdate]
 * @property {function} [rateLimit]
 * @property {function} [ready]
 * @property {function} [reconnecting]
 * @property {function} [resume]
 * @property {function} [roleCreate]
 * @property {function} [roleDelete]
 * @property {function} [roleUpdate]
 * @property {function} [typingStart]
 * @property {function} [typingStop]
 * @property {function} [userNoteUpdate]
 * @property {function} [userUpdate]
 * @property {function} [voiceStateUpdate]
 * @property {function} [warn]
 * @property {function} [webhookUpdate]
*/

/** @typedef {Object} GuildModule
 * @property {GuildModuleTranslation} translation
 * @property {Events} events
 * @property {GuildModuleFilters} filters
 * @property {GuildModuleCommands} commands
 */

/** @typedef {import("discord.js").Message} Message */
/** @typedef {import("discord.js").TextChannel} TextChannel */
/** @typedef {import("./index.js").default} BotInstance */

/** @typedef {Object} SafeVariables
 * @property {Message} message
 * @property {function(string,TextChannel?):Promise<Message>} send
 * @property {function(string,TextChannel?):Promise<Message>} sendOk
 * @property {function(string,Message):void} evalCmd
 * @property {function(boolean):void} setFiltering
 */
/** @typedef {SafeVariables & {botInstance:BotInstance,guildModules:GuildModules}} UnsafeVariables */

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
    help_cmds:        `Commands`,
    help_scopes:      `Scopes`,
    footer_yourCmds:  `These are your personalized commands after sending:`,
    footer_cmdInfo:   `Commands information`,
    system_loadSucc:  `File has been loaded`,
    system_loadFail:  `Wrong file data!`
  }
  /** @type {GuildModuleFilters} */
  filters = new Map()
  /** @type {GuildModuleCommands} */
  commands = {}
  /** @type {string} */
  botOperatorId = ``
  /** @type {UnsafeVariables} */
  unsafeVariables = {}
  /** @type {SafeVariables} */
  safeVariables = {}

  variablesSharedData = {
    filtering: true,
  }

  /** @type {Object<string,function[]>} */
  events = {}

  prefix = `cc!`
  prefixSpace = true
  eventBinder = () => {}

  /**
   *
   * @param {string} prefix
   * @param {string} prefixSpace
   * @param {function(string,function)} eventBinder
   */
  constructor( prefix, prefixSpace, eventBinder ) {
    this.prefix = prefix
    this.prefixSpace = prefixSpace
    this.eventBinder = eventBinder

    this.include( GuildModules.predefinedCommands )
  }

  /**
   * @param {GuildModule} param0
   */
  include( module ) {
    const { translation={}, events={}, commands={}, filters=[], botOperatorId=`` } = typeof module === `function`
      ? module( this.unsafeVariables )
      : module

    for (const event in events) {
      if (!(event in this.events)) {
        this.events[ event ] = []

        this.eventBinder( event, (...data) => this.events[ event ].forEach( f => f( ...data ) ) )
      }

      this.events[ event ].push( events[ event ] )
    }

    this.filters = filters.map( filterScope => Object.entries( filterScope ) )
      .map( filterScope => filterScope.map( ([ regExp, func ]) => {
        const [ regSource, regFlags ] = regExp.split( /\/$|\/(?=[gmiyus]+$)/ )

        return {
          regExp: new RegExp( regSource.slice( 1 ), regFlags ),
          func,
        }
      } ) )

    CommandProcessor.normalizeCommands( commands )

    GuildModules.safeCommandsAssign( this.commands, commands )
    this.translation = Object.assign( translation, this.translation )
    this.botOperatorId = botOperatorId
  }

  restoreVariablecSharedData() {
    const vars = this.variablesSharedData

    vars.filtering = true
  }

  /**
   * @param {Message} message
   * @param {BotInstance} botInstance
   */
  setVariables( message, botInstance ) {
    if (!message || !botInstance) throw new Error( `All parameters are required!` )

    for (const variables of [ this.safeVariables, this.unsafeVariables ]) {
      variables.send = (data, channel=message.channel) => channel.send( data )
      variables.sendOk = (data, channel=message.channel) => channel.send( `${botInstance.signs.ok} ${data}` )
      variables.setFiltering = boolState => this.variablesSharedData.filtering = boolState
      variables.evalCmd = (commandWithoutPrefix, msg=message) => {
        const command = `${this.prefix}${this.prefixSpace ? ` ` : ``}${commandWithoutPrefix}`

        new CommandProcessor( false, this.prefix, this.prefixSpace, command, this.commands ).process(
          roles => botInstance.checkPermissions( roles, this.botOperatorId, message ),
          err => botInstance.handleError( err, this.translation, msg ),
        )
      }
    }

    this.unsafeVariables.botInstance = botInstance
    this.unsafeVariables.guildModules = this
    this.unsafeVariables.message = message
    this.safeVariables.message = { ...message }
    this.safeVariables.message.guild = { ...message.guild }

    GuildModules.deletePropertyGlobaly( this.safeVariables.message, `client`, 2 )
    GuildModules.deletePropertyGlobaly( this.safeVariables.message.guild, `client`, 1 )
  }

  /**
   * @param {Message} message
   * @param {BotInstance} botInstance
   */
  process( message, botInstance, { filters=true, commands=true }={} ) {
    const { guild, content } = message
    const varsData = this.variablesSharedData

    this.restoreVariablecSharedData()
    this.setVariables( message, botInstance )

    if (filters) for (const filterScope of this.filters) {
      for (const { regExp, func } of filterScope) if (regExp.test( content )) {
        func()

        break
      }

      if (!varsData.filtering) break
    }


    if (commands) new CommandProcessor( !guild, this.prefix, this.prefixSpace, content, this.commands ).process(
      roles => botInstance.checkPermissions( roles, this.botOperatorId, message ),
      err => botInstance.handleError( err, this.translation, message ),
    )
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

      if ((deep === maxDeep && Object( prop ) === prop) || key === property) delete object[ key ]
      else if (prop && typeof prop === `object` && !Array.isArray( prop ) && !references.includes( prop )) {
        object[ key ] = { ...prop }

        deletePropG( object[ key ], deep + 1 )
      }
    } )

    deletePropG( object )
  }

  /** @param {UnsafeVariables} $ */
  static predefinedCommands = $ => ({ commands: {
    $: { d:`Bot administration`, r:`@owner`, v:{
      load: { d:`Load module from attached file`, v() {
        const { message, botInstance } = $
        const attachment = message.attachments.first()
        const guildId = message.guild.id

        if (attachment && attachment.url && !attachment.width) {
          const extension = attachment.filename.match( /.*\.([a-z]+)/ )[ 1 ] || `mjs`
          const fileName = `${guildId}-module.${extension}`
          const path = `${fs.realpathSync( `.` )}/guilds_modules/${fileName}`
          const file = fs.createWriteStream( path )

          https.get( attachment.url, res => res.pipe( file ).on( `finish`, () => {
            file.close()

            botInstance.loadModule( fileName )
          } ) )
        }
      }},
      setBotOperator: { d:`Set the ID of bot operator`, v( id=/\d{18}/) {
        $.guildModules.botOperatorId = id
      }},
      getModule: { d:`Get the module config file`, v() {
        let configFileName = `${fs.realpathSync( `.` )}/guilds_modules/${$.message.guild.id}-module`

        if (fs.existsSync( `${configFileName}.js` )) configFileName += `.js`
        else if (fs.existsSync( `${configFileName}.mjs` )) configFileName += `.mjs`
        else throw `That guild doesn't have the config file`

        $.send( { files:[ configFileName ] } )
      }}
    }},
  } })
}