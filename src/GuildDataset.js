import CommandProcessor, { Scope } from "./CommandProcessor.js"
import FiltersProcessor from "./FiltersProcessor.js"

/** @typedef {import("discord.js").Client} Client */
/** @typedef {import("discord.js").Guild} Guild */
/** @typedef {import("discord.js").Message} Message */
/** @typedef {import("discord.js").TextChannel} TextChannel */

/** @typedef {import("../index.js").default} CactuDiscordBot */
/** @typedef {import("./Logger.js").default} Logger */
/** @typedef {import("./CommandProcessor.js").Scope} ConfigCommands */
/** @typedef {import("./CommandProcessor.js").CommandsField} GuildCommandsField */
/** @typedef {import("./CommandProcessor.js").Role} Role */
/** @typedef {import("./CommandProcessor.js").CommandState} CommandState */
/** @typedef {import("./CommandProcessor.js").Command} Command */

/** ConfigTranslation
 * @typedef {Object} GuildTranslation
 * @property {string} [err_noParam] `Required parameter was not provided!`,
 * @property {string} [err_badParam] `Not valid parameter!`,
 * @property {string} [err_noPath] `Command does not exists!`,
 * @property {string} [err_noPerms] `You don't have permissions to use that!`,
 * @property {string} [err_tooManyParams] `Too many parameteres!`,
 * @property {string} [err_tooManyParamsUnnecessaryParam] `Unnecessary param`,
 * @property {string} [help_title] `Help for a syntax of the specified command`,
 * @property {string} [help_showDescription] `Send **??** as first parameter of command to show description and params syntax`,
 * @property {string} [help_optionalParam] `The __param**?**__ means parameter is optional`,
 * @property {string} [help_restParam] `The __**...**param__ means parameter can be any string`,
 * @property {string} [footer_yourCommands] `These are your personalized commands`,
 * @property {string} [label_scopes] `Scopes`,
 * @property {string} [label_commands] `Commands`,
 * @property {string} [label_providedValue] `Provided value`,
 * @property {string} [label_parameter] `Parameter`,
 * @property {string} [label_optional] `Optional`,
 * @property {string} [label_rest] `Rest`,
 * @property {string} [label_mask] `Mask`,
 * @property {string} [label_yes] `Yes`,
 * @property {string} [label_no] `No`,
 * @property {string} [system_loadSuccess] `Config has been loaded successfully`,
 * @property {string} [system_loadWithoutAttachment] `If you want to load configuration, you should attach .js file to the message!`,
 */

/** @typedef {{regExp:RegExp,func:function}[][]} GuildFilters */

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
  signs = { error:`❌`, warn:`⚠️`, ok:`✅` }

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
    this.filtersProcessor = new FiltersProcessor()

    this.clear()
  }

  /**
   * @param {Config} config
   */
  loadConfig( config ) {
    if (typeof config !== `object`) return null

    const {
      prefix,
      prefixSpace,
      botOperatorRoleName,
      translation = {},
      events = {},
      filters = [],
      commands,
      signs,
    } = config
    const minified = { commands:{} }
    this.commands = commands

    this.botOperatorRoleName = botOperatorRoleName

    Object.assign( this.translation, translation )
    Object.assign( this.signs, signs )

    if (prefix) this.commandsProcessor.setPrefix( prefix )
    if (prefixSpace) this.commandsProcessor.setPrefixSpace( prefixSpace )

    if (commands instanceof Scope) {
      // minified.commands = commands.getData({ onlyUnsafe:true, meta:false, serialized:false })

      // this.minifiedCommands = minified.commands
      this.commandsProcessor.setCommandsStructure( commands )
    }
    if (Array.isArray( filters )) {
      this.filtersProcessor.setFilters( filters )
    }


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
      err_noParam: `Required parameter was not provided!`,
      err_badParam: `Not valid parameter!`,
      err_noPath: `Command does not exists!`,
      err_noPerms: `You don't have permissions to use that!`,
      err_tooManyParams: `Too many parameteres!`,
      err_tooManyParamsUnnecessaryParam: `Unnecessary param`,
      help_title: `Help for a syntax of the specified command`,
      help_showDescription: `Send **??** as first command parameter to show its description (e.g. __prefix command ??__)`,
      help_optionalParam: `The __param**?**__ means parameter is optional`,
      help_restParam: `The __**...**param__ means parameter can be any string`,
      footer_yourCommands: `These are your personalized commands`,
      label_scopes: `Scopes`,
      label_commands: `Commands`,
      label_providedValue: `Provided value`,
      label_parameter: `Parameter`,
      label_optional: `Optional`,
      label_rest: `Rest`,
      label_mask: `Mask`,
      label_yes: `Yes`,
      label_no: `No`,
      system_loadSuccess: `Config has been loaded successfully!`,
      system_loadWithoutAttachment: `If you want to load configuration, you should attach .js file to the message!`,
    }
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
   * @param {(matches:string[]) => object} getFiltersVariables
   * @param {(state:CommandState) => object} getCommandVariables
   * @param {(state:CommandState) => void} performResponse
   * @param {(roles:Role[] botOperatorId:string) => boolean} checkPermissions
   * @param {{ filters:boolean commands:boolean }} param3
   */
  processMessage( message, getFiltersVariables, getCommandVariables, performResponse, checkPermissions, { filters = true, commands = true } = {} ) {
    if (filters) {
      const filtersMatch = this.filtersProcessor.process( message, getFiltersVariables )

      if (filtersMatch) return
    }

    if (commands) {
      const commandState = this.commandsProcessor.process( message, roles => checkPermissions( roles, this.botOperatorRoleName ) )

      if (!commandState) return

      const vars = getCommandVariables( commandState )

      if (commandState.type == `noPrefix`) return
      if (commandState.type != `readyToExecute`) return performResponse( commandState )

      /** @type {Command} */
      const cmd = commandState.value

      cmd.execute([ vars, ...cmd.parameters ])
    }
  }
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
