import fs from "fs"

import Discord from "discord.js"
import VM2Package from "vm2"

import GuildDataset from "./src/GuildDataset.js"
import Logger, { logUnderControl } from "./src/Logger.js"
import { Scope as CommandScope, Executor as CommandExecutor } from "./src/CommandProcessor.js"

import "./src/jsdoc.js"

if (!fs.existsSync( `./guild_configs/` )) fs.mkdirSync( `./guild_configs/` )

const __DIRNAME = import.meta.url.match( /(.*)\// )[ 1 ].slice( 8 )
const __APPDIRNAME = fs.realpathSync( `.` )


export const LoggerClass = Logger


/**
 * @constructor
 * @extends {CommandScope<DiscordCommandElementMetaPart>}
 */
export class Scope extends CommandScope {}


/**
 * @constructor
 * @extends {CommandExecutor<Variables,DiscordCommandElementMetaPart>}
 */
export class Executor extends CommandExecutor {}


export default class CactuDiscordBot {
  discordClient = new Discord.Client(
    { partials:[ `USER`, `CHANNEL`, `GUILD_MEMBER`, `MESSAGE`, `REACTION` ] },
  )

  /** @type {Map<string,GuildDataset>} */
  guildsDatasets = new Map()
  initialized = false
  vmConfig = {
    eval: false,
    wasm: false,
    require: false,
    nesting: false,
    fixAsync: true,
    timeout: 10,
    wrapper: `none`,
    sandbox: { Scope, Executor },
  }

  logMaxLength = 170
  loggers = {
    guild: new Logger( [
      { color:`white`,   value:`[{hh}:{mm}:{ss}] ` },             // "[hh:mm:ss] "
      { color:`magenta`, align:`right`, length:24, maxLen:24 },   // Guild name
      { color:`white`,   value:` :: ` },                          // " :: "
      { color:`magenta`, align:`left`,  length:20, maxLen:20 },   // Channel name
      { color:`white`,   value:` :: ` },                          // " :: "
      { color:`blue`,    align:`right`, length:7 },               // /(Filter|Command)/
      { color:`white`,   value:`: ` },                            // ": "
      { color:`yellow`,  align:`right`, length:15, maxLen:25 },   // Member display name
      { color:`white`,   value:`: ` },                            // ": "
      { color:`white`,   splitLen:this.logMaxLength, firstSplitLen:(this.logMaxLength - 80) }, // Message
    ], { separateBreakBlock:true, newLinePrefix:`   -  -  | ` } ),
    dm: new Logger( [
      { color:`white`,   value:`[{hh}:{mm}:{ss}] ` },             // "[hh:mm:ss] "
      { color:`magenta`, align:`right`, length:19 },              // Author id
      { color:`white`,   value:`#` },                             // "#"
      { color:`magenta`, length:4 },                              // Author discriminator
      { color:`white`,   value:` :: ` },                          // " :: "
      { color:`magenta`, value:`DM`, length:20 },                 // "DM"
      { color:`white`,   value:` :: ` },                          // " :: "
      { color:`blue`,    align:`right`, length:7 },               // /(Filter|Command)/
      { color:`white`,   value:`: ` },                            // ": "
      { color:`yellow`,  align:`right`, length:15, maxLen:25 },   // Member display name
      { color:`white`,   value:`: ` },                            // ": "
      { color:`white`,   splitLen:this.logMaxLength, firstSplitLen:(this.logMaxLength - 80) }, // Message
    ], { separateBreakBlock:true, newLinePrefix:`   -  -  | ` } ),
    info: new Logger( [
      { color:`white`,   value:`[{hh}:{mm}:{ss}] ` },       // "[hh:mm:ss] "
      { color:`blue`,    value:` info `, bold:true },       // " i "
      { color:`white`,   value:` ` },                       // " "
      { color:`white`,   splitLen:this.logMaxLength, firstSplitLen:(this.logMaxLength - 10) }, // Message
    ], { separateBreakBlock:true, newLinePrefix:`   -  -  | ` } ),
    system: new Logger( [
      { color:`magenta`, value:`  Bot` },                   // "Bot"
      { color:`white`,   value:`: ` },                      // ": "
      { color:`white`,   splitLen:this.logMaxLength, firstSplitLen:(this.logMaxLength - 10) }, // Message
    ], { separated:true, separateBreakBlock:false } ),
  }

  prefix = `cc!`
  prefixSpace = true
  events = {}
  signs = { error:`❌`, warn:`⚠️`, ok:`✅` }
  supportedEvents = {
    /**
     * @param {MessageReaction} reaction
     * @param {User} user
     */
    messageReactionAdd( reaction, user ) {

    },
  }


  /** @param {CactuDiscordBotConfig} config */
  constructor( config ) {
    if (`prefix`          in config) this.prefix          = config.prefix
    if (`prefixSpace`     in config) this.prefixSpace     = config.prefixSpace
    if (`publicVars`      in config) this.publicVars      = config.publicVars
    if (`idOfGuildToCopy` in config) this.idOfGuildToCopy = config.idOfGuildToCopy
    if (`signs`           in config) this.signs           = config.signs
    if (`logMaxLength`    in config) this.logMaxLength    = config.logMaxLength

    this.discordClient
      .on( `message`, this.onMessage )
      .on( `ready`, this.onReady )
      .on( `messageUpdate`, this.onMessageUpdate )
      .on( `guildCreate`, this.onGuildCreate )
      .on( `guildDelete`, ({ name }) => this.log( `I left from guild named [fgYellow]${name}[]` ) )
      .login( config.token || `` )
      .catch( err => this.log( `I can't login in.\n${err}` ) )
  }


  /** @param {string} moduleName */
  loadModule = moduleFolder => {
    if (!moduleFolder) return

    const guildId = moduleFolder.match( /(\d{18})--(.*)$/ )[ 1 ]
    const guildDataset = this.guildsDatasets.get( guildId )

    if (guildDataset) {
      const configCode = fs.readFileSync( `${__APPDIRNAME}/${moduleFolder}`, { encoding:`utf-8` } )
      const importsAndStartingCommentsTrimmer = /(?:(?:import |\/\/|\/\*[\s\S]*?\*\/).*\r?\n)*([\s\S]*)/

      try {
        const script = configCode.match( importsAndStartingCommentsTrimmer )[ 1 ]
        const config = new VM2Package.VM( this.vmConfig ).run( `(() => {${script}})()` )

        guildDataset.loadConfig( config )
      } catch (err) {
        // console.error( err )
        return /** @type {Error} */ (err).message
      }
    }
  }


  clearGuildModules( guildIdToRemove, ...excludeNames ) {
    const dotPath = `${fs.realpathSync( `.` )}`

    fs.readdirSync( `${dotPath}/guilds_modules` ).forEach( filename => {
      const [ guildId ] = filename.split( `-` )

      try {
        if (!excludeNames.includes( filename ) && guildId === guildIdToRemove) fs.unlinkSync( `${dotPath}/guilds_modules/${filename}` )
      } catch (err) {
        this.log( `I can't remove module file (${filename}).` )
      }
    } )

    this.guildsData.get( guildIdToRemove ).clear()
  }


  /** @param {string} string */
  log( string, type = `system` ) {
    let logger = null

    switch (type) {
      case `info`:
        logger = this.loggers.info
        break

      case `system`:
      default:
        logger = this.loggers.system
    }

    logUnderControl( logger, string )
  }


  /**
   * @param {Permission} roleNames
   * @param {Discord.Snowflake} botOperatorId
   * @param {Discord.Message} param2
   */
  checkPermissions( roleNames, botOperatorId, { author, member, guild } ) {
    if (roleNames == `@everyone`) return true

    const memberRoles = member.roles.cache

    if (author.bot) return roleNames.includes( `@bot` )
    if (author.id === guild.ownerID || memberRoles.has( botOperatorId )) return true

    for (const roleName of roleNames) {
      const roleObject = guild.roles.cache.find( r => r.name === roleName )
      const havingARole = roleObject ? memberRoles.has( roleObject.id ) : false

      if (havingARole) return true
    }
  }


  /**
   * @param {CommandError} param0
   * @param {GuildModuleTranslation} translation
   * @param {Discord.Message} message
   */
  handleError( { type, value, paramMask }, translation, message ) {
    const { author, channel } = message
    const { error } = this.signs
    let title = `Unknown error`
    let description = ``
    let footerTxt = translation.footer_cmdInfo

    switch (type) {
      case `badParam`:
        title = `${error} ${translation.err_badParam}`
        description = `> ${value}  \`${paramMask}\``
        break

      case `details`:
        title = `⚙️ ${translation.help_title}`
        description = value.description
        footerTxt = `${translation.footer_cmdInfo}: ${value.command}`

        if (!value.params.length) break

        description += `\`\`\`js`

        for (const { param, mask, optional, rest } of value.params) {
          const beforEqual = `${rest ? `...` : ``}${param}${optional ? `?` : ` `}`
          const field = `${beforEqual.padStart( 29, ` ` )  } = ${mask}`

          description += `\n${  field.padEnd( 60, ` ` )}`
        }

        message.delete()

        description += `\n\`\`\`\n${translation.help_masks} https://regexr.com/`
        break

      case `noCommand`: {
        const fields = []
        const scopes = []
        const cmds = []
        const fieldNameStart = value.command + (value.command === this.prefix && !this.prefixSpace ? `` : ` `)

        description = value.command === this.prefix
          ? `${translation.help_showMasks}\n${translation.help_params}\n\n`
          : `\n\n`

        for (const part in value.structure) {
          const { type, desc, params } = value.structure[ part ]

          if (type == `scope`) {
            scopes.push({ name:`${fieldNameStart}***${part}***...`, value:(desc || `-  -  -`), inline:true })
          } else {
            const paramsStrings = []

            for (const { param, rest, optional } of params) {
              paramsStrings.push( `${rest ? `...` : ``}${param}${optional ? `?` : ``}` )
            }

            const paramsString = paramsStrings.length
              ? `  \` ${paramsStrings.join( `   ` )} \``
              : ``

            cmds.push({
              name: `${fieldNameStart}***${part}***${paramsString}`,
              value: desc || `-  -  -`,
            })
          }
        }

        if (scopes.length) {
          description += `${translation.help_scopes}:`
          fields.push( ...scopes, { name:`\u200B`, value:`${translation.help_cmds}:` } )
        } else description += `${translation.help_cmds}:`

        message.delete()

        fields.push( ...cmds )

        title = `⚙️ ${translation.help_title}`

        channel.send({ embed: { title, description, fields,
          color: 0x18d818,
          author: {
            name: `CodeCactu`,
            icon_url: this.discordClient.user.displayAvatarURL(),
            url: `https://codecactu.github.io/`,
          },
          footer: {
            text: `${translation.footer_yourCmds} ${value.command}`,
            icon_url: author.displayAvatarURL(),
          },
          timestamp: new Date(),
        } })

        return
      }

      case `noParam`:
        title = `${error} ${translation.err_noParam}`
        description = `> ${value}  \`${paramMask}\``
        break

      case `noPath`:
        title = `${error} ${translation.err_noPath}`
        description = `> ${value}`
        break

      case `noPerms`:
        title = `${error} ${translation.err_noPerms}`
        description = `> ${value}`
        break

      case `noPrefix`:
        return

      case `invalidCmd`:
        title = `${error} ${translation.err_invalidCmd}`

        if (typeof value === `string`) {
          title = `${error} ${translation.err_error}`
          description = `> \`${value}\` `
        } else description = `> \`${value.message}\` ${  value.stack.split( `\n` )[ 1 ]
          .split( /-/ )
          .slice( -1 )[ 0 ]
          .slice( 0, -1 )}`
        break
    }

    channel.send({ embed: { title, description,
      color: 0x18d818,
      author: {
        name: `CodeCactu`,
        icon_url: this.discordClient.user.displayAvatarURL(),
        url: `https://codecactu.github.io/`,
      },
      footer: {
        text: footerTxt,
        icon_url: author.displayAvatarURL(),
      },
      timestamp: new Date(),
    } })
  }


  /**
   * @param {CommandState} state
   * @param {Discord.Message} message
   */
  performResponse( state, message ) {
    /** @param {string} str */
    const processTooLongString = str => str.length > 20 ? str.slice( 0, 20 ) + `...` : str
    /** @param {string} str */
    const escapeString = str => str.replace( /`|_|\*|\|\|/g, `` )
    /** @param {string} str */
    const processUserString = str => escapeString( processTooLongString( str ) )

    const { trigger, type, value } = state
    let embed = {}

    switch (type) {
      case `noPrefix`: return


      case `scope`: {
        const scopes = value.filter( ({ type }) => type == `scope` )
          .map( ({ name, meta }) => ({ name, value:(meta.shortDescription || `- - -`), inline:true }) )

        const cmds = value.filter( ({ type }) => type == `executor` )
          .map( ({ name, meta }) => {
            const params = meta.params.map( ({ name, rest, optional }) => `${rest ? `...` : ``}${name}${optional ? `?` : ``}` )
            const sygnature = `${name} ${params.join( ` ` )}`

            return { name:sygnature, value:(meta.shortDescription || `- - -`) }
          } )

        embed = {
          fields: [
            { name:`\u200b`, value:`Zestawy poleceń:` },
            ...scopes,
            { name:`\u200b`, value:`Polecenia:` },
            ...cmds,
          ],
        }
        break
      }


      case `noParam`: {
        const { param, mask, optional, rest } = value
        embed = `**No param**: ${param}\n**Optional**: ${optional},   **rest**: ${rest},   **mask**: ${mask}`
        break
      }


      case `badParam`: {
        const { param, mask, optional, rest } = value
        embed = `**Bad param**: ${processUserString( param )}\n**Optional**: ${optional},   **rest**: ${rest},   **mask**: ${mask}`
        break
      }


      case `noPath`: {
        embed = `**No path \`${processUserString( value )}\`**`
        break
      }


      case `noPerms`: {
        embed = `**No access permissions to \`${value}\`**`
        break
      }


      case `tooManyParams`: {
        embed = `**Too many parameters**\nUnnecessary param: \`${processUserString( value )}\``
        break
      }


      case `details`: {
        embed = `${value.command} --- ${value.description}`
        break
      }


      case `readyToExecute`: {
        return console.log( type, value )
      }


      default:
        embed = `Unknown command state`
        break
    }

    if (!embed) return

    const processedTrigger = trigger.split( / +/ ).map( processUserString ).join( ` ` )

    message.delete()
    message.channel.send({ embed: (typeof embed === `object` ? embed : {
      title: embed,
      color: 0x2f3136,
      footer: {
        text: message.member.displayName + `   --   ` + (processedTrigger.length > 50 ? processedTrigger.slice( 0, 50 ) + `...` : processedTrigger),
        icon_url: message.author.displayAvatarURL(),
      },
      // timestamp: new Date(),
    }) })
  }


  /** @param {Discord.Message} message */
  getGguildDatasets( message ) {
    const { guild, author } = message

    const id = guild
      ? guild.id
      : author
        ? author.client.guilds.cache.find( ({ id }) => this.discordClient.guilds.cache.has( id ) ).id
        : null

    if (!id || !author || (author.bot && author.id === this.discordClient.user.id)) return

    return this.guildsDatasets.get( id )
  }


  eventBinder = (guild, eventName, listener) => {
    if (!(eventName in this.events)) {
      this.events[ eventName ] = []
    }

    this.events[ eventName ].push( listener )
  }


  /** @param {Discord.Message} message */
  onMessage = message => {
    const { guild, channel, member, author, content } = message

    if (!content) return

    const state = this.getGguildDatasets( message )?.processMessage(
      content,
      (roles, botOperatorRoleId) => this.checkPermissions( roles, botOperatorRoleId, message ),
    )

    if (!state || state.type == `noPrefix`) return

    if (guild) {
      if (guild.id != `315215466215899146`) return
      logUnderControl( this.loggers.guild, guild.name, channel.name, `type`, member.displayName, content )
    } else {
      logUnderControl( this.loggers.dm, author.id, author.discriminator, `type`, author.username, content )
    }

    this.performResponse( state, message )
  }


  /**
   * @param {Discord.Message} oldMessage
   * @param {Discord.Message} newMessage
   */
  onMessageUpdate = (oldMessage, newMessage) => {
    // const guildData = this.getGuildData( newMessage )

    // if (guildData) guildData.process( newMessage, this, { commands:false } )
  }


  onReady = () => {
    console.log()
    this.log( `Initialization started!` )
    console.log()

    this.discordClient.guilds.cache.forEach( guild => this.onGuildCreate( guild ) )

    this.discordClient.user.setActivity( this.prefix, { type:`WATCHING` } )

    console.log()
    this.log( `I have been started!` )
    this.initialized = true
  }


  /** @param {Discord.Guild} guild */
  onGuildCreate = guild => {
    const { id, name } = guild
    const path = `./guild_configs/${id}--${name.slice( 0, 20 ).replace( / /g, `-` )}${name.length > 20 ? `...` : ``}/`
    const configPath = `${path}config.js`

    this.guildsDatasets.set( id, new GuildDataset( this, guild, this.loggers.guild, this.eventBinder ) )

    if (!fs.existsSync( path )) fs.mkdirSync( path )

    if (!fs.existsSync( configPath )) {
      if (this.idOfGuildToCopy && this.idOfGuildToCopy != id) {
        const configToCopyFolderPath = fs.readdirSync( path )
          .filter( filename => filename.split( `--` )[ 0 ] === this.idOfGuildToCopy )[ 0 ]

        fs.copyFileSync( `${configToCopyFolderPath}config.js`, configPath )
      } else {
        fs.writeFileSync( configPath, `` )
      }
    }

    const error = this.loadModule( configPath )

    if (this.initialized) this.log( `I have joined to guild named [fgYellow]${name}[]`, `info` )
    else {
      let message = `I'm on guild named [fgYellow]${name}[]`

      if (error) message += `\n[fgRed]CONFIG LOADING ERROR[]: ${error}`

      this.log( message )
    }
  }
}
