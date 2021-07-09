import Discord from "discord.js"

import BotClientBase, { logUnderControl, ProcessedMessage } from "./src/botClientBase.js"
export { Scope, Executor, Filter } from "./src/botClientBase.js"

/** @extends BotClientBase<Discord.Client,Discord.Guild> */
export default class CactuDiscordBot extends BotClientBase {
  events = {}
  supportedEvents = {
    /**
     * @param {Discord.MessageReaction} reaction
     * @param {Discord.User} user
     */
    messageReactionAdd( reaction, user ) {

    },
  }


  /** @param {CactuDiscordBotConfig} config */
  constructor( config ) {
    const client = new Discord.Client(
      { partials:[ `USER`, `CHANNEL`, `GUILD_MEMBER`, `MESSAGE`, `REACTION` ] },
    )

    super( client, config )

    client
      .on( `message`, this.onMessage )
      .on( `ready`, this.onReady )
      .on( `messageUpdate`, this.onMessageUpdate )
      .on( `guildCreate`, this.onGuildCreate )
      .on( `guildDelete`, ({ name }) => this.log( `I left from guild named [fgYellow]${name}[]` ) )
      .login( config.token || `` )
      .catch( err => this.log( `I can't login in.\n${err}` ) )
  }


  /** @param {Discord.Message} message */
  getGguildDatasets( message ) {
    const { guild, author } = message

    const id = guild
      ? guild.id
      : author
        ? author.client.guilds.cache.find( ({ id }) => this.appClient.guilds.cache.has( id ) ).id
        : null

    if (!id || !author || (author.bot && author.id === this.appClient.user.id)) return

    return this.guildsDatasets.get( id )
  }


  /**
   * @param {Permission[]} roles
   * @param {string} botOperatorRoleName
   * @param {Discord.Message} param2
   */
  checkPermissions( roles, botOperatorRoleName, { author, member, guild } ) {
    const dm = roles.includes( `@dm` )

    if (!guild) return dm
    if (author.bot) return roles.includes( `@bot` )
    if (!roles.length || roles.includes( `@everyone` )) return true
    if ((author.id === this.botOwnerId || author.id === guild.ownerID) && (!dm || roles.includes( `@server_admin` ))) return true

    const memberRoles = member.roles.cache

    if (memberRoles.find( ({ name }) => name === botOperatorRoleName )) return true

    for (const role of roles) {
      if (role.charAt( 0 ) === `@`) {
        const roleName = role.slice( 1 )

        if (/^\d+$/.test( roleName )) {
          if (author.id == roleName) return true
        }
      } else {
        const roleObject = guild.roles.cache.find( r => r.name === role )
        const havingARole = roleObject ? memberRoles.has( roleObject.id ) : false

        if (havingARole) return true
      }
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
            icon_url: this.appClient.user.displayAvatarURL(),
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
        icon_url: this.appClient.user.displayAvatarURL(),
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
   * @param {GuildDataset} guildDataset
   * @param {Discord.Message} message
   */
  performResponse( state, guildDataset, message ) {
    const getParamStr = ({ name, rest, optional }) => `${rest ? `...` : ``}${name}${optional ? `?` : ``}`
    const processTooLongString = str => str.length > 20 ? str.slice( 0, 20 ) + `...` : str
    const escapeString = str => str.replace( /`|_|\*|\|\|/g, `` )
    const processUserString = str => escapeString( processTooLongString( str ) )

    const t9n = guildDataset.translation
    const { trigger, type, value } = state
    const processedTrigger = trigger.split( / +/ ).map( processUserString ).join( ` ` )

    let embed = {
      color: 0x2f3136,
      footer: {
        text: message.member.displayName + `   --   ` + (processedTrigger.length > 50 ? processedTrigger.slice( 0, 50 ) + `...` : processedTrigger),
        icon_url: message.author.displayAvatarURL(),
      },
      // timestamp: new Date(),
    }

    switch (type) {
      case `noPrefix`: return


      case `scope`: {
        const scopes = value.filter( ({ type }) => type == `scope` )
          .map( ({ name, meta }) => ({ name, value:(meta.shortDescription || `- - -`), inline:true }) )

        const cmds = value.filter( ({ type }) => type == `executor` )
          .map( ({ name, meta }) => {
            const params = meta.params.map( getParamStr )
            const sygnature = `${trigger} *${name}*` + (params.length ? `  \` ${params.join( `  ` )} \`` : ``)

            return { name:sygnature, value:(meta.shortDescription || `- - -`) }
          } )

        embed = {
          color: 0x5a9f32,
          title: t9n.help_title,
          description: trigger.split( ` ` ).length > 1 ? `` : `
            ${t9n.help_showDescription}

            ${t9n.help_optionalParam}
            ${t9n.help_restParam}
          `,
          fields: [],
          footer: {
            text: message.member.displayName + `   --   ` + t9n.footer_yourCommands,
            icon_url: message.author.displayAvatarURL(),
          },
        }

        if (scopes.length) embed.fields.push( { name:`\u200b`, value:`${t9n.label_scopes}:` }, ...scopes )
        if (cmds.length) embed.fields.push( { name:`\u200b`, value:`${t9n.label_commands}:` }, ...cmds )

        break
      }


      case `noParam`: {
        const { name, optional, rest, mask, maskName } = value
        embed.title = t9n.err_noParam
        embed.fields = [
          { name:t9n.label_parameter, value:getParamStr({ name, optional, rest }), inline:true },
          { name:t9n.label_mask, value:`\`${maskName ?? mask}\``, inline:true },
        ]
        break
      }


      case `badParam`: {
        const { name, optional, rest, param, mask, maskName } = value
        embed.title = t9n.err_badParam
        embed.fields = [
          { name:t9n.label_parameter, value:getParamStr({ name, optional, rest }), inline:true },
          { name:t9n.label_providedValue, value:param, inline:true },
          { name:t9n.label_mask, value:`\`${maskName ?? mask}\``, inline:true },
        ]
        break
      }


      case `noPath`: {
        embed.title = `**${t9n.err_noPath} \`${processUserString( value )}\`**`
        break
      }


      case `noPerms`: {
        embed.title = `**${t9n.err_noPerms} \`${value}\`**`
        break
      }


      case `tooManyParams`: {
        embed.title = `**${t9n.err_tooManyParams}**`
        embed.description = `${t9n.err_tooManyParamsUnnecessaryParam}: \`${processUserString( value )}\``
        break
      }


      case `details`: {
        embed.title = `${value.command} --- ${value.description}`
        break
      }


      case `readyToExecute`: {
        return console.log( type, value )
      }


      default:
        embed.title = `Unknown command state`
        break
    }

    if (!embed) return

    message.delete()
    message.channel.send({ embed })
  }


  /**
   * @param {GuildDataset} guildDataset
   * @param {Discord.Message} message
   */
  getVariables( guildDataset, message ) {
    return {
      nativeMessage: message,
      guildDataset: guildDataset,
      bot: this,
      message: new ProcessedMessage( message ),

      /** @param {string} msg */
      response( msg ) {
        return message.channel.send( msg ).then( m => new ProcessedMessage( m ) )
      },

      /** @param {string} msg */
      sendOk( msg ) {
        return this.response( `${guildDataset.signs.ok}  ${msg}` )
      },

      /** @param {string} msg */
      sendErr( msg ) {
        return this.response( `${guildDataset.signs.error}  ${msg}` )
      },
    }
  }


  /**
   * @param {Command} command
   * @param {GuildDataset} guildDataset
   * @param {Discord.Message} message
   */
  getCommandVariables( command, guildDataset, message ) {
    const { guild, channel, member, author, content } = message

    if (guild) {
      if (guild.id != `315215466215899146`) return
      logUnderControl( this.loggers.guild, guild.name, channel.name, `command`, member.displayName, content )
    } else {
      logUnderControl( this.loggers.dm, author.id, author.discriminator, `command`, author.username, content )
    }

    return this.getVariables( guildDataset, message )
  }


  /**
   * @param {string[]} matches
   * @param {GuildDataset} guildDataset
   * @param {Discord.Message} message
   */
  getFiltersVariables( matches, guildDataset, message ) {
    const { guild, channel, member, content } = message

    logUnderControl( this.loggers.guild, guild.name, channel.name, `filter`, member.displayName, content )

    return { ...this.getVariables( guildDataset, message ), matches }
  }


  eventBinder = (guild, eventName, listener) => {
    if (!(eventName in this.events)) {
      this.events[ eventName ] = []
    }

    this.events[ eventName ].push( listener )
  }


  /** @param {Discord.Message} message */
  onMessage = message => {
    if (!message.content) return

    const guildDataset = this.getGguildDatasets( message )

    guildDataset?.processMessage(
      message.content,
      matches => this.getFiltersVariables( matches, guildDataset, message ),
      ({ value }) => this.getCommandVariables( value, guildDataset, message ),
      state => this.performResponse( state, guildDataset, message ),
      (roles, botOperatorRoleId) => this.checkPermissions( roles, botOperatorRoleId, message ),
      { filters:!!message.guild, commands:true },
    )
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
    this.appClient.guilds.cache.forEach( guild => this.onGuildCreate( guild ) )
    this.appClient.user.setActivity( this.prefix, { type:`WATCHING` } )

    this.endInitialization()
  }


  /** @param {Discord.Guild} guild */
  onGuildCreate = guild => {
    this.createGuild( guild, guild.id, guild.name )
  }
}
