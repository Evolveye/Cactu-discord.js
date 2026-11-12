import * as Discord from "discord.js"
import { Executor, Filter, Module, Scope } from "../core/namespaceStructure/index.js"
import type { Namespace, ModuleConfig } from "../core/namespaceStructure/index.js"
import type FileStorage from "../core/FileStorage/index.js"
import type CactuDiscordBot from "./DiscordBot.js"

export type DCChannel = Discord.TextBasedChannel | Discord.DMChannel | Discord.PartialDMChannel | Discord.NewsChannel | Discord.StageChannel | Discord.TextChannel | Discord.PrivateThreadChannel | Discord.PublicThreadChannel<boolean> | Discord.VoiceChannel
export type DCReply = Promise<null | Discord.InteractionResponse<boolean> | Discord.Message<boolean>>

/** Context of text commands and filters (`$` in module configs) */
export type ModuleCtx = {
  bot: CactuDiscordBot
  ns: Namespace<DCModule>
  msg: null | Discord.Message
  member: null | Discord.GuildMember
  channel: null | DCChannel
  send: (msg:string | Discord.MessagePayload | Discord.MessageCreateOptions) => DCReply
  sendOk: (msg:string) => DCReply
  deleteMsg: () => Promise<void | Discord.Message<boolean>>
  runCmd: (command:string) => Promise<void>
  getStorage: () => Promise<undefined | FileStorage>
  getWebHook: (channel:Discord.Channel) => Promise<null | Discord.Webhook>
}

export type ModuleCmdCtx = {
  bot: CactuDiscordBot
  registrationGuildId: string
  ns: Namespace<DCModule>
  cmd: Discord.ChatInputCommandInteraction<Discord.CacheType>
  send: (msg:string | Discord.MessagePayload | Discord.MessageCreateOptions) => DCReply
  runCmd: (command:string) => Promise<void>
  getStorage: () => Promise<undefined | FileStorage>
  getWebHook: (channel:Discord.Channel) => Promise<null | Discord.Webhook>
}

export type ModuleInteractionCtx = {
  getStorage: (guildId?:string) => Promise<undefined | FileStorage>
}

export type DCInteractionHandler = (interaction:Discord.Interaction, ctx:ModuleInteractionCtx) => void
export type DCModuleEvent = Partial<{ [K in keyof Discord.ClientEvents]:(...args:Discord.ClientEvents[K]) => void }>

export type DCModuleConfig = ModuleConfig<ModuleCtx> & {
  interactions?: Record<string, DCInteractionHandler>
  events?: DCModuleEvent
  slashCommands?: Record<string, DCCmdExecutor>
}

/** A slash command; `forPrivateMessages` registers it globally, so it works in DMs too */
export class DCCmdExecutor extends Executor<ModuleCmdCtx, { forPrivateMessages: boolean }> {}
export class DCExecutor extends Executor<ModuleCtx> {}
export class DCFilter extends Filter<ModuleCtx> {}
export class DCScope extends Scope {}

export default class DCModule extends Module<ModuleCtx> {
  interactions: Record<string, DCInteractionHandler> = {}
  events: DCModuleEvent = {}
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
    if (module.events) Object.assign( target.events, module.events )
    if (module.slashCommands) Object.assign( target.slashCommands, module.slashCommands )
    if (module.interactions) Object.assign( target.interactions, module.interactions )
  }
}
