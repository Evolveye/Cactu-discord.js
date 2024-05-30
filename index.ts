import { ExecutorParam } from "src/namespaceStructure/Scope.js"
import Discord, { ActivityType, ChannelType, Partials, REST, Routes } from "discord.js"
import { SlashCommandBooleanOption, SlashCommandBuilder, SlashCommandMentionableOption, SlashCommandNumberOption, SlashCommandStringOption } from "@discordjs/builders"
import { Namespace, CommandPermissionsError, CommandError, ProcessorResponseHandlerParam, ExecutionError, MissingExecutionParameter, WrongExecutionParameter, OverlimitedExecutorParameter, NoCommandError, RuntimeExecutionError, ProcessorParam, CtxFromModule } from "./src/namespaceStructure/index.js"
import DCModule, { ModuleCmdCtx, Scope, TranslationObject } from "./src/DCModule/index.js"
import BotBase, { BotBaseConfig, NamespaceInfo } from "./src/BotClientBase.js"

export { default as DCModule } from "./src/DCModule/index.js"
export * from "./src/DCModule/index.js"

export type Config = BotBaseConfig & {
  appOwnerId?: string
  botToken: string
  appId: string
}

export default class CactuDiscordBot extends BotBase<DCModule> {
  client: Discord.Client
  rest: REST
  ownerId: undefined | string = undefined
  globals = {
    commands: new Map<string, SlashCommandBuilder>(),
  }

  constructor( config:Config ) {
    super()

    if (!config?.botToken) throw new Error( `Config object have to have "botToken" field` )
    if (config.appOwnerId) this.ownerId = config.appOwnerId

    this.rest = new REST().setToken( config.botToken )
    this.client = new Discord.Client({
      intents: (2 ** 22 - 1), // All intents
      partials: [ Partials.Channel, Partials.Message ],
    })

    this.client
      .on( `messageCreate`, this.handleMessage )
      // .on( `messageUpdate`, this.onMessageUpdate )
      .on( `guildCreate`, this.handleGuild )
      .on( `interactionCreate`, this.handleInterraction )
      .on( `guildDelete`, ({ name }) => this.logSystem( `I left from guild named [fgYellow]${name}[]` ) )
      .on( `ready`, this.onReady )
      .login( config.botToken )
      .catch( err => this.logSystem( `I can't login in.\n${err}` ) )
  }


  getGuildNamespace = (message:Discord.Message) => {
    const { guild, author } = message

    const id = guild
      ? guild.id
      : author
        ? author.client.guilds.cache.find( ({ id }) => this.client.guilds.cache.has( id ) )?.id
        : null

    if (!id || !author || (author.bot && author.id === this.client.user?.id)) return

    return this.namespacesData.get( id )
  }


  handleMessage = (message:Discord.Message) => {
    if (!message.content || message.author.id === this.client.user?.id) return

    const msgType = message.channel.type

    switch (msgType) {
      case ChannelType.GuildText: {
        this.logServer( message.guild?.name ?? `- - -`, message.channel.name, message.author.username, `Message`, message.content )
        break
      }

      case ChannelType.DM: {
        this.logDM( message.channel.recipient?.username ?? message.channel.recipientId, message.author.username, `Message`, message.content )
        break
      }
    }

    const guildNamespace = this.getGuildNamespace( message )

    if (!guildNamespace) return

    const ctx:ProcessorParam<CtxFromModule<DCModule>> = {
      message: message.content,
      checkPermissions: perms => this.checkPermissions( perms, message ),
      executorDataGetter: () => ({
        bot: this,
        ns: guildNamespace,
        msg: message,
        member: message.member,
        channel: message.channel,
        send: async msg => `send` in message.channel ? message.channel.send( msg ) : null,
        sendOk: async msg => `send` in message.channel ? message.channel.send( `✅ ${msg}` ) : null,
        getStorage: async() => !message.guild ? undefined : this.getNamespaceFileStorage( this.getGuildFolderName( message.guild ) ),
        deleteMsg: () => message.delete(),
        runCmd: command => guildNamespace.processMessage({
          ...ctx,
          checkPermissions: () => true,
          message: command,
          prefix: null,
        }),
        getWebHook: (channel?:Discord.Channel) => this.getWebHook( channel ?? message.channel ),
      }),
      handleResponse: response => this.handleResponse( response, guildNamespace, {
        channel: message.channel,
        member: message.member,
        user: message.author,
      } ),
    }

    guildNamespace.processMessage( ctx )
  }


  checkPermissions = (perms:string[], message:Discord.Message) => {
    if (perms.includes( `_NOBODY` )) return false
    if (message.author.bot) return perms.includes( `_BOT` )

    if (!perms.length) return true
    if (message.author.id === this.ownerId) return true
    if (perms.includes( message.author.id )) return true
    if (perms.includes( `!` + message.author.id )) return false

    const { member } = message

    if (member) {
      const roleNames = member.roles.cache.map( r => [ r.name, r.id ] ).flat() ?? []
      const PermFlags = Discord.PermissionsBitField.Flags

      if (perms.some( p => roleNames.includes( p ) )) return true
      if (perms.includes( `_ADMIN` ) && member.permissions.has( PermFlags.Administrator )) return true
    }

    return false
  }


  handleResponse = (response:ProcessorResponseHandlerParam, ns:Namespace<DCModule>, { channel, member, user }:{ channel: null | Discord.DMChannel | Discord.PartialDMChannel | Discord.NewsChannel | Discord.StageChannel | Discord.TextChannel | Discord.PrivateThreadChannel | Discord.PublicThreadChannel<boolean> | Discord.VoiceChannel; member: Discord.GuildMember | Discord.APIInteractionGuildMember | null; user: Discord.User }) => {
    const t:TranslationObject = ns.getCompoundModule().translation

    if (!channel) return

    const username = member && `displayName` in member ? member.displayName : user.username

    if (response instanceof Error) {
      const embed = {
        color: 0xb7603d,
        description: ``,
        footer: {
          text: username,
          icon_url: user.displayAvatarURL(),
        },
      }

      if (response instanceof CommandError) {
        embed.footer.text += ` :: ` + response.path.join( ` ` )

        if (response instanceof NoCommandError) embed.description = t[ `err.noPath` ] ?? `No command`
        else if (response instanceof CommandPermissionsError) embed.description = t[ `err.noPerms` ] ?? `You have no permissions to do this`
      } else if (response instanceof ExecutionError) {
        if (response instanceof MissingExecutionParameter) embed.description = t[ `err.noParam` ] ?? `Missing parameter`
        else if (response instanceof WrongExecutionParameter) embed.description = t[ `err.badParam` ] ?? `Bad parameter`
        else if (response instanceof OverlimitedExecutorParameter) embed.description = t[ `err.tooManyParams` ] ?? `Too many parameters`
        else if (response instanceof RuntimeExecutionError) {
          // this.logSystem( `[fgRed]ERR[]: Path="${ns.getCompoundModule().prefix + response.node?.path}", location="${response.commandLocation}"` )
          this.logSystem( `[fgRed]ERR[]: ${response}` )
          embed.description = t[ `err.invalidCommand` ] ?? `This command has invalid code`
        }
      }

      embed.description = `**` + (t[ `err.error` ] ?? `Error`) + `** :: ` + embed.description

      channel.send({ embeds:[ embed ] })
      return
    }

    if (response.typeInstance instanceof Scope) {
      const compoundModule = ns.getCompoundModule()
      const path =  compoundModule.prefix + response.path.join( ` ` ) + ` `
      const scopeItems = response.typeInstance.getItemsInfo()

      const scopesFields:Discord.APIEmbedField[] = []
      const executorsFields:Discord.APIEmbedField[] = []
      const fields:Discord.APIEmbedField[] = []

      for (const item of scopeItems) {
        if (item.type === `scope`) scopesFields.push({
          name: path + ` ***` + item.name + `*** \`...\``,
          value: item.shortDescription ?? ``,
          inline: true,
        })

        if (item.type === `executor` && `params` in item) executorsFields.push({
          name: path
            + ` ***` + item.name + `*** `
            + item.params.map( p => `  **\` ${p.type == `message` ? `...` : ``}${p.name}${p.optional ? `?` : ``} \`**  ` ).join( `` ),
          value: item.shortDescription ?? ``,
          inline: false,
        })
      }

      if (scopesFields.length) for (let i = 0;  i < 3 - ((scopesFields.length + 1) % 3);  i++) scopesFields.push({ name:`\u200b`, value:`\u200b`, inline:true })

      if (scopesFields.length) fields.push(
        { name:``, value:t[ `help.scopes` ] ?? `Scopes` },
        ...scopesFields,
      )

      if (executorsFields.length) fields.push(
        { name:scopeItems.length ? `\u200b` : ``, value:t[ `help.commands` ] ?? `Commands` },
        ...executorsFields,
      )

      if (!scopesFields.length && !executorsFields.length) fields.push({ name:`\u200b`, value:t[ `help.nothing` ] ?? `Nothing is here`, inline:false })

      const embed:Discord.APIEmbed = {
        color: 0x4ee910,
        title: t[ `help.title` ] ?? `⚙️ Help for commands`,
        description: response.path.length ? `` : ``
          + `* ` + (t[ `help.optionalParam` ] ?? `Sign **\`?\`** means parameter is optional`) + `\n`
          + `* ` + (t[ `help.restParam` ] ?? `Dots **\`...\`** means parameter can be a sentence`),
        fields,
        footer: {
          text: username + ` :: ` + compoundModule.prefix + response.path.join( ` ` ),
          icon_url: user.displayAvatarURL(),
        },
      }

      channel.send({ embeds:[ embed ] })

      return
    }
  }


  handleGuild = async(guild:Discord.Guild) => {
    const namespace = await this.registerNamespace( guild.id, {
      name: guild.name,
      folderName: this.getGuildFolderName( guild ),
    } )

    const handleEveryLoad = () => {
      const app = this.client.application

      if (app) {
        const ns = this.namespacesData.get( guild.id )

        if (ns) {
          // Delete all commands
          // this.rest.put( Routes.applicationGuildCommands( this.client.application.id, guild.id ), { body:[] } )
          //   .then( () => console.log( `Successfully deleted all guild commands for ${guild.name}` ) )

          const commands:SlashCommandBuilder[] = []
          const privateCommands:SlashCommandBuilder[] = []

          for (const [ commandName, executor ] of Object.entries( ns.getCompoundModule().slashCommands )) {
            let cmd = new SlashCommandBuilder()
              .setName( commandName )
              .setDescription( executor.meta.shortDescription ?? executor.meta.detailedDescription ?? `- - -` )

            const createOption = <T extends SlashCommandNumberOption | SlashCommandStringOption | SlashCommandBooleanOption | SlashCommandMentionableOption>(option:T, p:ExecutorParam): T => {
              option = option
                .setName( p.name.toLowerCase().replace( / /g, `_` ) )
                .setRequired( !p.optional ) as T

              if (p.desc) option = option.setDescription( p.desc ) as T

              return option
            }

            executor.meta.params.forEach( p => {
              if (p.type === `mention`) return cmd = cmd.addMentionableOption( opt => createOption( opt, p ) ) as SlashCommandBuilder
              if (p.type === `bool`) return cmd = cmd.addBooleanOption( opt => createOption( opt, p ) ) as SlashCommandBuilder
              if (p.type === `number`) return cmd = cmd.addNumberOption( opt => createOption( opt, p ) ) as SlashCommandBuilder
              if (p.type === `message`) return cmd = cmd.addStringOption( opt => createOption( opt, p ) ) as SlashCommandBuilder
            } )

            if (executor.meta.forPrivateMessages) privateCommands.push( cmd )
            else commands.push( cmd )
          }

          privateCommands.forEach( c => this.globals.commands.set( c.name, c ) )

          this.rest.put( Routes.applicationGuildCommands( app.id, guild.id ), { body:commands } )
            .catch( err => {
              if (err?.rawError?.message) console.log( `Error`, err.rawError.message, JSON.stringify( err.rawError.errors, null, 2 ) )
              else console.log( err )
            } )
        }
      }

      Object.entries( namespace.getCompoundModule().events ).forEach( ([ eventName, eventhandler ]) => {
        this.client.on( eventName, eventhandler )
      } )
    }

    namespace.on( `everyLoad`, handleEveryLoad )
    namespace.on( `preReload`, () => {
      Object.entries( namespace.getCompoundModule().events ).forEach( ([ eventName, eventhandler ]) => {
        this.client.removeListener( eventName, eventhandler )
      } )
    } )

    handleEveryLoad()
  }


  handleInterraction = (interaction:Discord.Interaction) => {
    if (!interaction.guildId) return

    const ns = this.namespacesData.get( interaction.guildId )

    if (!ns) return
    if (interaction.isChatInputCommand()) {
      const slashCommand = ns.getCompoundModule().slashCommands[ interaction.commandName ]

      if (!slashCommand) return

      const ctx:ModuleCmdCtx = {
        ns,
        cmd: interaction,
        bot: this,
        runCmd: command => ns.processMessage({
          message: command,
          prefix: null,
          checkPermissions: () => true,
          executorDataGetter: () => ({
            bot: this,
            ns,
            msg: null,
            member: interaction.member && `displayName` in interaction.member ? interaction.member : null,
            channel: interaction.channel,
            send: msg => {
              if (typeof msg === `string`) return interaction.reply({ content:msg })
              if (`content` in msg) return interaction.reply({ content:msg.content, components:msg.components })
              throw new Error( `Cannot send message` )
            },
            sendOk: msg => interaction.reply( `✅ ${msg}` ),
            getStorage: async() => !interaction.guild ? undefined : this.getNamespaceFileStorage( this.getGuildFolderName( interaction.guild ) ),
            deleteMsg: async() => {
              interaction.deferReply()
              interaction.deleteReply()
            },
            runCmd: command => ns.processMessage({ ...ctx, message:command }),
            getWebHook: (channel?:Discord.Channel) => this.getWebHook( channel ?? interaction.channel ),
          }),
          handleResponse: response => this.handleResponse( response, ns, {
            channel: interaction.channel,
            member: interaction.member,
            user: interaction.user,
          } ),
        }),
        send: msg => {
          if (typeof msg === `string`) return interaction.reply({ content:msg })
          if (`content` in msg) return interaction.reply({ content:msg.content, components:msg.components })
          throw new Error( `Cannot send message` )
        },
        getStorage: async() => !interaction.guild ? undefined : this.getNamespaceFileStorage( this.getGuildFolderName( interaction.guild ) ),
        getWebHook: (channel?:Discord.Channel) => this.getWebHook( channel ?? interaction.channel ),
      }

      const params = slashCommand.meta.params.map( p => interaction.options.data.find( d => d.name === p.name.toLowerCase() )?.value )
      slashCommand.execute( params, ctx )
    }

    if (!(`customId` in interaction)) return

    const { interactions } = ns.getCompoundModule()

    let interactionFn = interactions[ interaction.customId ]

    if (!interactionFn) interactionFn = Object.entries( interactions )
      .filter( ([ k ]) => k.startsWith( `/` ) && k.endsWith( `/` ) )
      .find( ([ k ]) => new RegExp( k.slice( 1, -1 ) ).test( interaction.customId ) )
      ?.[ 1 ]

    interactionFn?.( interaction, {
      getStorage: async guildId => {
        if (!guildId && !interaction.guild) return undefined

        const guild = guildId ? this.client.guilds.cache.get( guildId ) : interaction.guild

        return !guild ? undefined : this.getNamespaceFileStorage( this.getGuildFolderName( guild ) )
      },
    } )
  }


  onReady = () => {
    const app = this.client.application

    this.client.user?.setActivity({ name:`Growing plants`, type:ActivityType.Watching })

    Promise.allSettled( this.client.guilds.cache.map( guild => this.handleGuild( guild ) ) )
      .then( () => {
        if (app) this.rest.put( Routes.applicationCommands( app.id ), { body:[ ...this.globals.commands.values() ] } )
          .catch( err => {
            if (err?.rawError?.message) console.log( `Error`, err.rawError.message, JSON.stringify( err.rawError.errors, null, 2 ) )
            else console.log( err )
          } )
      } )

    this.endInitialization()
  }


  async getWebHook( channel:null | Discord.Channel | Discord.ThreadChannel ) {
    if (!channel) return null

    const guildChannel = channel.type === ChannelType.PublicThread ? channel.parent : channel

    if (guildChannel?.type !== ChannelType.GuildText) return null

    const hooks = await guildChannel.fetchWebhooks().catch( console.log ).then( hook => hook ?? null )
    const existingCactuHook = hooks?.find( ({ name }) => name == `CactuHaczyk` )

    if (existingCactuHook) return existingCactuHook

    const cactuHook = await guildChannel.createWebhook({ name:`CactuHaczyk`, avatar:`https://cdn.discordapp.com/avatars/379234773408677888/a062f0b67e42116104554c1d3e3b695f.png?size=2048` })
      .catch( console.log ).then( hook => hook ?? null )

    return cactuHook
  }

  getGuildFolderName( guild:Discord.Guild ) {
    const parsedName = guild.name.slice( 0, 20 ).replace( / [^ ]/g, match => match.trim().toUpperCase() ).trim() + (guild.name.length > 20 ? `...` : ``)
    return guild.id + `--` + parsedName
  }

  getNamespaceInfoFromGuild( guildId:string ): null | NamespaceInfo<DCModule>
  getNamespaceInfoFromGuild( guild:Discord.Guild ): null | NamespaceInfo<DCModule>
  getNamespaceInfoFromGuild( guildOrItsId:string | Discord.Guild ): null | NamespaceInfo<DCModule> {
    const guild = typeof guildOrItsId === `string` ? this.client.guilds.cache.get( guildOrItsId ) : guildOrItsId
    if (!guild) return null
    return super.getNamespaceInfo( this.getGuildFolderName( guild ), guild.id )
  }
}
