import CommandProcessor, { Scope, Executor } from "./CommandProcessor.js"
import CommandWorker from "./CommandsWorker.js"
import fs from "fs"
import https from "https"

/** @typedef {import("discord.js").Client} Client */
/** @typedef {import("discord.js").Guild} Guild */
/** @typedef {import("discord.js").Message} Message */
/** @typedef {import("discord.js").TextChannel} TextChannel */

/** @typedef {import("../index.js").default} CactuDiscordBot */
/** @typedef {import("./Logger.js").default} Logger */
/** @typedef {import("./CommandProcessor.js").Scope} ConfigCommands */
/** @typedef {import("./CommandProcessor.js").CommandsField} GuildCommandsField */
/** @typedef {import("./CommandProcessor.js").Role} Role */

/** ConfigTranslation
 * @typedef {Object} ConfigTranslation
 * @property {string} [err_badParam]
 * @property {string} [err_noCommand]
 * @property {string} [err_noParam]
 * @property {string} [err_noPath]
 * @property {string} [err_noPerms]
 * @property {string} [err_noPrefix]
 * @property {string} [err_invalidCmd]
 * @property {string} [err_error]
 * @property {string} [err_attachFile]
 * @property {string} [help_title]
 * @property {string} [help_showMasks]
 * @property {string} [help_params]
 * @property {string} [help_masks]
 * @property {string} [help_cmds]
 * @property {string} [help_scopes]
 * @property {string} [footer_yourCmds]
 * @property {string} [footer_cmdInfo]
 * @property {string} [system_loadSucc]
 * @property {string} [system_loadFail]
 */

/** @typedef {{regExp:RegExp,func:function}[][]} ConfigFilters */

/** ConfigSupportedEvents
 * @typedef {Object} ConfigSupportedEvents For details look at Events on https://discord.js.org/#/docs/main/stable/class/Client
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

/**
 * @typedef {Object} Config
 * @property {ConfigTranslation} translation
 * @property {ConfigSupportedEvents} events
 * @property {ConfigFilters} filters
 * @property {ConfigCommands} commands
 */


/**
 * @typedef {Object} SafeVariables
 * @property {Message} message
 * @property {function(string,TextChannel?):Promise<Message>} send
 * @property {function(string,TextChannel?):Promise<Message>} sendOk
 * @property {function(string,Message):void} evalCmd
 * @property {function(string,*):void} setSharedData
 */
/** @typedef {SafeVariables & {botInstance:BotInstance,guildModules:GuildModules}} UnsafeVariables */

export default class GuildDataset {
  executiongWorker = new CommandWorker()

  /** @type {GuildTranslation} */
  translation = {}

  /** @type {GuildFilters} */
  filters = new Map()

  /** @type {GuildCommands} */
  commands = {}
  minifiedCommands = {}

  /** @type {Object<string,function[]>} */
  events = {}

  /** @type {string} */
  botOperatorRoleId = ``

  /**
   * @param {CactuDiscordBot} botInstance
   * @param {Guild} guild
   * @param {Logger} logger
   * @param {function(string,function)} eventBinder
   */
  constructor( botInstance, guild, logger, eventBinder ) {
    this.botInstance = botInstance
    this.guild = guild
    this.logger = logger
    this.eventBinder = eventBinder
    this.commandsProcessor = new CommandProcessor()

    this.clear()
  }

  /**
   * @param {Config} config
   */
  loadConfig( config ) {
    if (typeof config !== `object`) return null

    const {
      translation = {},
      events = {},
      commands,
      filters = [],
      botOperatorId = ``,
      prefix,
      prefixSpace,
    } = config
    const minified = { commands:{} }
    this.commands = commands

    if (prefix) this.commandsProcessor.setPrefix( prefix )
    if (prefixSpace) this.commandsProcessor.setPrefixSpace( prefixSpace )

    if (commands instanceof Scope) {
      commands.setSafety( false )
      commands.merge( GuildDataset.predefinedCommands, true )

      minified.commands = commands.getData({ onlyUnsafe:true, meta:false, serialized:false })

      this.minifiedCommands = minified.commands
      this.commandsProcessor.setCommandsStructure( commands )
    }

    this.executiongWorker.emit( `set commands`, {
      guildId: this.guild.id,
      config: minified,
    } )


    // for (const event in events) {
    //   if (!(event in this.events)) {
    //     this.events[ event ] = []

    //     this.eventBinder( event, (...data) => {
    //       const { guild, message } = data[ 0 ]

    //       if (guild) {
    //         if (guild.id != this.guildId) return
    //       } else if (message) {
    //         if (message.guild.id != this.guildId) return
    //       } else return

    //       if (event in this.events) this.events[ event ].forEach( f => f( ...data ) )
    //       else console.log( `Something went wrong with event emmiter!`, event, this.events )
    //     } )
    //   }

    //   this.events[ event ].push( events[ event ] )
    // }

    // this.filters = filters.map( filterScope => Object.entries( filterScope ) )
    //   .map( filterScope => filterScope.map( ([ regExp, func ]) => {
    //     const [ regSource, regFlags ] = regExp.split( /\/$|\/(?=[gmiyus]+$)/ )

    //     return {
    //       regExp: new RegExp( regSource.slice( 1 ), regFlags ),
    //       func,
    //     }
    //   } ) )

    // CommandProcessor.normalizeCommands( commands )

    // GuildDataset.safeCommandsAssign( this.commands, commands )
    // this.translation = Object.assign( this.translation, translation )
    // this.botOperatorId = botOperatorId
  }

  clear() {
    this.filters = new Map()
    this.commands = {}
    this.minifiedCommands = {}
    this.events = {}
    this.translation = {
      err_badParam: `Not valid parameter!`,
      err_noCommand: `This is scope, not a command!`,
      err_noParam: `Required parameters weren't passed!`,
      err_noPath: `Command doesn't exists`,
      err_noPerms: `You don't have permissions to use that!`,
      err_noPrefix: `You didn't pass the prefix`,
      err_invalidCmd: `That command have invalid code!`,
      err_error: `Error!`,
      err_attachFile: `You should attach module file!`,
      help_title: `Help for a syntax of the specified command`,
      help_showMasks: `Send **??** as first parameter of command to show description and params syntax`,
      help_params: `The X**?** means optional parameter and the **...**X means any string`,
      help_masks: `If you don't know what is going on, you can ask somebody from server stuff, or you can check "masks" on`,
      help_cmds: `Commands`,
      help_scopes: `Scopes`,
      footer_yourCmds: `These are your personalized commands after sending:`,
      footer_cmdInfo: `Commands information`,
      system_loadSucc: `File has been loaded`,
      system_loadFail: `Wrong file data!`,
    }

    this.loadConfig( this.getPredefinedCommands() )
  }

  restoreVariablecSharedData() {
    const vars = this.variablesSharedData

    vars.filtering = true
    vars.filterMatch = false
  }

  /**
   * @param {Message} message
   * @param {BotInstance} botInstance
   */
  setVariables( message, botInstance ) {
    if (!message || !botInstance) throw new Error( `All parameters are required!` )

    for (const variables of [ this.safeVariables, this.unsafeVariables ]) {
      variables.send = (data, channel = message.channel) => channel.send( data )
      variables.sendOk = (data, channel = message.channel) => channel.send( `${botInstance.signs.ok} ${data}` )
      variables.setSharedData = (property, value) =>
        property in this.variablesSharedData ? (this.variablesSharedData[ property ] = value) : false
      variables.evalCmd = (commandWithoutPrefix, msg = message) => {
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

    GuildDataset.deletePropertyGlobaly( this.safeVariables.message, `client`, 2 )
    GuildDataset.deletePropertyGlobaly( this.safeVariables.message.guild, `client`, 1 )
  }

  /**
   * @param {string} message
   * @param {(roles:Role[] botOperatorId:string) => boolean} checkPermissions
   * @param {{ filters:boolean commands:boolean }} param3
   */
  processMessage( message, checkPermissions, handleState, { filters = true, commands = true } = {} ) {
    return this.commandsProcessor.process( message, checkPermissions )
    // const { guild, content } = message
    // const username = message.member ? message.member.displayName : message.author.username
    // const log = (type, log = content) => this.logger( guild.name, message.channel.name, type, username, log )

    // if (filters) {
    //   let filteringContent = content

    //   for (const filterScope of this.filters) {
    //     for (const { regExp, func } of filterScope) if (regExp.test( content )) {
    //       varsData.filterMatch = true
    //       func()

    //       if (varsData.filterMatch) filteringContent = filteringContent.replace( regExp, match => `[fgRed]${match}[]` )

    //       break
    //     }

    //     if (!varsData.filtering) break
    //   }

    //   if (varsData.filterMatch) log( `Filter`, filteringContent )
    // }

    // if (commands) new CommandProcessor( !guild, this.prefix, this.prefixSpace, content, this.commands ).process(
    //   roles => botInstance.checkPermissions( roles, this.botOperatorId, message ),
    //   err => botInstance.handleError( err, this.translation, message ),
    //   () => log( `Command` ),
    // )
  }

  getPredefinedCommands() {
    const t = this.translation
    const { botInstance } = this

    return new Scope( {
      get description() { return t.help_showMasks + `\n` + t.help_params },

    }, {

      $: new Scope({
        shortDescription: `Bot administration`,
        roles: `@server_admin`,

      }, {

        load: new Executor({
          shortDescription: `Clear all modules data and load new module from attached file`,
        }, $ => {
          // const { message } = $
          // const attachment = message.attachments.first()
          // const guildId = message.guild.id

          // if (!attachment) throw t.err_attachFile
          // if (attachment.url && !attachment.width) {
          //   const path = `./guild_configs/${guildId}--${message.guild.name.slice( 0, 20 ).replace( / /g, `-` )}/`
          //   const configPath = fs.createWriteStream( `${path}config.js` )

          //   https.get( attachment.url, res => res.pipe( configPath ).on( `finish`, () => {
          //     modulePath.close()

          //     if ($.message.author.id !== `263736841025355777` && /(?<!\/\*\* @typedef { *)import|require/gi.test( fs.readFileSync( path ) )) {
          //       console.log( `Matched imports!` )
          //     }

          //     botInstance.clearGuildModules( guildId, fileName )
          //     botInstance.loadModule( fileName )

          //     message.delete()

          //     $.sendOk( t.system_loadSucc )
          //   } ) )
          // }
        },
        ),

      }),

    },
    )
  }

  /**
   * @param {Object<string,*>} target
   * @param {Object<string,*>} object
   */
  static safeCommandsAssign( target, object ) {
    Object.keys( object ).forEach( key => {
      switch (typeof object[ key ]) {
        case `undefined`:
          break

        case `object`:
          if (Array.isArray( object[ key ] )) {
            if (!(key in target)) target[ key ] = object[ key ]
          } else target[ key ] = this.safeCommandsAssign( target[ key ] || {}, object[ key ] )
          break

        case `function`:
          if (key in target) break

        default:
          target[ key ] = object[ key ]
      }
    } )

    return target
  }

  /**
   * @param {Object<string,*>} object
   * @param {string} property
   */
  static deletePropertyGlobaly( object, property, maxDeep = Infinity ) {
    const references = []
    const deletePropG = (object, deep = 0) => Object.keys( object ).forEach( key => {
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
  static predefinedCommands = new Scope( {}, {
    $: new Scope( { d:`Bot administration`, r:`@server_admin` }, {
      load: new Executor( { d:`Clear all modules data and load new module from attached file` }, $ => {} ),
      setBotOperator: new Executor( { d:`Set the ID of bot operator` }, ($, id = /\d{18}/) => {} ),
      getModules: new Executor( { d:`Get the guild module config files` }, $ => {} ),
    } ),
  } )

  static DEPRECATED_COMMANDS = $ => ({ commands: {
    $: { d: `Bot administration`, r: `@owner`, v: {
      load: { d: `Clear all modules data and load new module from attached file`, v() {
        const { message, botInstance } = $
        const attachment = message.attachments.first()
        const guildId = message.guild.id
        const { translation } = $.guildModules

        if (!attachment) throw translation.err_attachFile
        if (attachment.url && !attachment.width) {
          const extension = attachment.name.match( /.*\.([a-z]+)/ )[ 1 ] || `mjs`
          const fileName = `${guildId}-${Date.now()}-module.${extension}`
          const path = `./guilds_modules/${fileName}`
          const file = fs.createWriteStream( path )

          https.get( attachment.url, res => res.pipe( file ).on( `finish`, () => {
            file.close()

            if ($.message.author.id !== `263736841025355777` && /eval|(?<!\/\*\* @typedef {)import/gi.test( fs.readFileSync( path ) )) {
              throw translation.system_loadFail
            }

            botInstance.clearGuildModules( guildId, fileName )
            botInstance.loadModule( fileName )

            message.delete()

            $.sendOk( translation.system_loadSucc )
          } ) )
        }
      } },
      setBotOperator: { d: `Set the ID of bot operator`, v( id = /\d{18}/ ) {
        $.guildModules.botOperatorId = id
      } },
      getModules: { d: `Get the guild module config files`, v() {
        const pathToModules = `${fs.realpathSync( `.` )}/guilds_modules`
        const guildId = $.message.guild.id
        const urls = []

        fs.readdirSync( pathToModules ).forEach( filename => {
          if (filename.split( /-/g )[ 0 ] === guildId) urls.push( `guilds_modules/${filename}` )
        } )

        if (urls.length === 0) throw `That guild doesn't have the config file`

        $.message.channel.send({ files:urls })
      } },
    } },
  } })
}

function getDate( format, date = Date.now() ) {
  const options = { year:`numeric`, month:`2-digit`, day:`2-digit`, hour:`2-digit`, minute:`2-digit` }
  const [ { value:DD },, { value:MM },, { value:YYYY },, { value:hh },, { value:mm } ] = new Intl.DateTimeFormat( `pl`, options )
    .formatToParts( date )

  return format
    .replace( /YYYY/, YYYY )
    .replace( /YY/, YYYY.slice( -2 ) )
    .replace( /MM/, MM )
    .replace( /DD/, DD )
    .replace( /hh/, hh )
    .replace( /mm/, mm )
}
