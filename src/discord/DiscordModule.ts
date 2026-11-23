import * as Discord from "discord.js"
import { Executor, Filter, Module, Scope } from "../core/namespaceStructure/index.js"
import type { Namespace, ModuleConfig } from "../core/namespaceStructure/index.js"
import type { HttpEndpointHandler } from "../core/http/HttpServer.js"
import type CactuDiscordBot from "./DiscordBot.js"

export type DCChannel = Discord.TextBasedChannel | Discord.DMChannel | Discord.PartialDMChannel | Discord.NewsChannel | Discord.StageChannel | Discord.TextChannel | Discord.PrivateThreadChannel | Discord.PublicThreadChannel<boolean> | Discord.VoiceChannel
export type DCReply = Promise<null | Discord.InteractionResponse<boolean> | Discord.Message<boolean>>

/** Context of text commands and filters (`$` in module configs) */
export type ModuleCtx = {
  bot: CactuDiscordBot
  ns: Namespace<DCModule>
  msg: null | Discord.Message
  /** Set when a slash command started this text command (`runCmd`) */
  interaction?: Discord.ChatInputCommandInteraction
  member: null | Discord.GuildMember
  channel: null | DCChannel
  send: (msg:string | Discord.MessagePayload | Discord.MessageCreateOptions) => DCReply
  sendOk: (msg:string) => DCReply
  deleteMsg: () => Promise<void | Discord.Message<boolean>>
  runCmd: (command:string) => Promise<void>
  getWebHook: (channel:Discord.Channel) => Promise<null | Discord.Webhook>
}

export type ModuleCmdCtx = {
  bot: CactuDiscordBot
  registrationGuildId: string
  ns: Namespace<DCModule>
  cmd: Discord.ChatInputCommandInteraction<Discord.CacheType>
  send: (msg:string | Discord.MessagePayload | Discord.MessageCreateOptions) => DCReply
  runCmd: (command:string) => Promise<void>
  getWebHook: (channel:Discord.Channel) => Promise<null | Discord.Webhook>
}

export type DCInteractionHandler = (interaction:Discord.Interaction) => void

/** Suggestions for an option while it's typed, at most 25; `typed` is the option's text so far */
export type DCAutocompleter = (interaction:Discord.AutocompleteInteraction, typed:string) => Promise<Discord.ApplicationCommandOptionChoiceData<string>[]>
/** A client event listener; a list, so several modules of one namespace can listen to the same event */
export type DCEventListener = { name: string, listener: (...args:unknown[]) => void }

/** Starts something when the namespace (re)loads; a returned function is its cleanup, run before the next reload */
export type DCSetup = () => unknown

/** A handler of the bot's HTTP server (`POST /path`); a list, so several modules of one namespace can serve the same endpoint */
export type DCEndpoint = { endpoint: string, handler: HttpEndpointHandler }

export type DCModuleConfig = ModuleConfig<ModuleCtx> & {
  interactions?: Record<string, DCInteractionHandler>
  events?: DCEventListener[]
  setups?: DCSetup[]
  endpoints?: DCEndpoint[]
  slashCommands?: Record<string, DCCmdExecutor>
}

/** A slash command; `forPrivateMessages` registers it globally, so it works in DMs too */
export class DCCmdExecutor extends Executor<ModuleCmdCtx, { forPrivateMessages: boolean, groupDescription: string }> {
  /** The text options suggesting values while they're typed, by parameter name */
  autocompleters = new Map<string, DCAutocompleter>()
}
export class DCExecutor extends Executor<ModuleCtx> {}
export class DCFilter extends Filter<ModuleCtx> {}
export class DCScope extends Scope {}

export default class DCModule extends Module<ModuleCtx> {
  interactions: Record<string, DCInteractionHandler> = {}
  events: DCEventListener[] = []
  setups: DCSetup[] = []
  endpoints: DCEndpoint[] = []
  slashCommands: Record<string, DCCmdExecutor> = {}

  constructor( config:DCModuleConfig ) {
    super( config )
    DCModule.merge( this, config )
  }

  merge<T extends DCModuleConfig>(module:T) {
    Module.merge( this, module )
    DCModule.merge( this, module )
  }

  static merge( target:DCModule, module:DCModuleConfig ) {
    if (module.events) target.events.push( ...module.events )
    if (module.setups) target.setups.push( ...module.setups )
    if (module.endpoints) target.endpoints.push( ...module.endpoints )
    if (module.slashCommands) Object.assign( target.slashCommands, module.slashCommands )
    if (module.interactions) Object.assign( target.interactions, module.interactions )
  }
}
