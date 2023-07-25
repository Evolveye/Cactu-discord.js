import Discord, { REST, ActivityType, ChannelType, Partials } from "discord.js"
import { Namespace, CommandPermissionsError, CommandError, ProcessorResponseHandlerParam, ExecutionError, MissingExecutionParameter, WrongExecutionParameter, OverlimitedExecutorParameter, NoCommandError, RuntimeExecutionError, ProcessorParam, CtxFromModule } from "./src/namespaceStructure/index.js"
import DCModule, { Scope, TranslationObject } from "./src/DCModule/index.js"
import BotBase, { BotBaseConfig } from "./src/BotClientBase.js"

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
    if (!message.content) return

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
        ns: guildNamespace,
        msg: message,
        send: msg => message.channel.send( msg ),
        sendOk: msg => message.channel.send( `✅ ${msg}` ),
        deleteMsg: () => message.delete(),
        runCmd: command => guildNamespace.processMessage({
          ...ctx,
          checkPermissions: () => true,
          message: command,
          prefix: null,
        }),
        getWebHook: (channel?:Discord.Channel) => this.getWebHook( channel ?? message.channel ),
      }),
      handleResponse: response => this.handleResponse( response, guildNamespace, message ),
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


  handleResponse = (response:ProcessorResponseHandlerParam, ns:Namespace<DCModule>, message:Discord.Message) => {
    const t:TranslationObject = ns.getCompoundModule().translation

    if (response instanceof Error) {
      const embed = {
        color: 0xb7603d,
        description: ``,
        footer: {
          text: (message.member?.displayName ?? message.author.username),
          icon_url: message.author.displayAvatarURL(),
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
        else if (response instanceof RuntimeExecutionError) embed.description = t[ `err.invalidCommand` ] ?? `This command have invalid code`
      }

      embed.description = `**` + (t[ `err.error` ] ?? `Error`) + `** :: ` + embed.description

      message.channel.send({ embeds:[ embed ] })
      return
    }

    if (response.typeInstance instanceof Scope) {
      const path =  ns.getCompoundModule().prefix + response.path.join( ` ` ) + ` `
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
        })
      }

      if (scopesFields.length) for (let i = 0;  i < 3 - ((scopesFields.length + 1) % 3);  i++) scopesFields.push({ name:`\u200b`, value:`\u200b`, inline:true })

      if (scopesFields.length) fields.push(
        { name:``, value:t[ `label.scopes` ] ?? `Scopes` },
        ...scopesFields,
      )

      if (executorsFields.length) fields.push(
        { name:scopeItems.length ? `\u200b` : ``, value:t[ `label.commands` ] ?? `Commands` },
        ...executorsFields,
      )

      if (!scopesFields.length && !executorsFields.length) fields.push({ name:`\u200b`, value:t[ `help.nothing` ] ?? `Nothing is here` })

      const embed:Discord.APIEmbed = {
        color: 0x4ee910,
        title: t[ `help.title` ] ?? `⚙️ Help for commands`,
        description: response.path.length ? `` : ``
          + `* ` + (t[ `help.optionalParam` ] ?? `Sign **\`?\`** means parameter is optional`) + `\n`
          + `* ` + (t[ `help.restParam` ] ?? `Dots **\`...\`** means parameter can be a sentence`),
        fields,
        footer: {
          text: (message.member?.displayName ?? message.author.username) + ` :: ` + response.path.join( ` ` ),
          icon_url: message.author.displayAvatarURL(),
        },
      }

      message.channel.send({ embeds:[ embed ] })

      return
    }
  }


  handleGuild = async(guild:Discord.Guild) => {
    const parsedName = guild.name.slice( 0, 20 ).replace( / [^ ]/g, match => match.trim().toUpperCase() ).trim() + (guild.name.length > 20 ? `...` : ``)
    const namespace = await this.registerNamespace( guild.id, {
      name: guild.name,
      folderName: guild.id + `--` + parsedName,
    } )

    const handleEveryLoad = () => {
      Object.entries( namespace.getCompoundModule().events ).forEach( ([ eventName, eventhandler ]) => {
        console.log( eventName )
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
    if (!interaction.guildId || !(`customId` in interaction)) {
      console.log({ interaction })
      return
    }

    const ns = this.namespacesData.get( interaction.guildId )

    ns?.getCompoundModule().interactions[ interaction.customId ]?.( interaction )
  }


  onReady = () => {
    this.client.guilds.cache.forEach( guild => this.handleGuild( guild ) )
    this.client.user?.setActivity({ name:`My pings`, type:ActivityType.Watching })

    this.endInitialization()
  }


  async getWebHook( channel:Discord.Channel ) {
    if (channel.type !== Discord.ChannelType.GuildText) return null

    const hooks = await channel.fetchWebhooks().catch( console.log ).then( hook => hook ?? null )
    const existingCactuHook = hooks?.find( ({ name }) => name == `CactuHaczyk` )

    if (existingCactuHook) return existingCactuHook

    const cactuHook = await channel.createWebhook({ name:`CactuHaczyk`, avatar:`https://cdn.discordapp.com/avatars/379234773408677888/a062f0b67e42116104554c1d3e3b695f.png?size=2048` })
      .catch( console.log ).then( hook => hook ?? null )

    return cactuHook
  }
}
