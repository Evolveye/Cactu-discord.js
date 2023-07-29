import Discord, { InteractionResponse } from "discord.js"
import { Namespace, Executor, Filter, Module, ModuleConfig, Scope } from "../namespaceStructure/index.js"

export { Executor, Filter, Module, Scope }

export type TranslationKeys =
  | `err.noPath`
  | `err.noPerms`
  | `err.noParam`
  | `err.badParam`
  | `err.tooManyParams`
  | `err.invalidCommand`
  | `err.error`
  | `err.noAttachment`
  | `help.title`
  | `help.showDescription`
  | `help.optionalParam`
  | `help.nothing`
  | `help.restParam`
  | `help.commands`
  | `help.scopes`
  | `label.providedValue`
  | `label.parameter`
  | `label.optional`
  | `label.rest`
  | `label.mask`
  | `label.yes`
  | `label.no`
  | `system.loadSuccess`

export type DCChannel = Discord.TextBasedChannel | Discord.DMChannel | Discord.PartialDMChannel | Discord.NewsChannel | Discord.StageChannel | Discord.TextChannel | Discord.PrivateThreadChannel | Discord.PublicThreadChannel<boolean> | Discord.VoiceChannel
export type TranslationObject = Partial<Record<TranslationKeys, string>>

export type ModuleCtx = {
  ns: Namespace<DCModule>
  msg: null | Discord.Message
  member: null | Discord.GuildMember
  channel: null | DCChannel
  send: (msg:string | Discord.MessagePayload | Discord.MessageCreateOptions) => Promise<InteractionResponse<boolean> | Discord.Message<boolean>>
  sendOk: (msg:string) => Promise<InteractionResponse<boolean> | Discord.Message<boolean>>
  deleteMsg: () => Promise<void | Discord.Message<boolean>>
  runCmd: (command:string) => Promise<void>
  getWebHook: (channel:Discord.Channel) => Promise<null | Discord.Webhook>
}

export type ModuleCmdCtx = {
  ns: Namespace<DCModule>
  cmd: Discord.ChatInputCommandInteraction<Discord.CacheType>
  runCmd: (command:string) => Promise<void>
  getWebHook: (channel:Discord.Channel) => Promise<null | Discord.Webhook>
}

type DCModuleEvent = Partial<{ [K in keyof Discord.ClientEvents]:(...args:Discord.ClientEvents[K]) => void}>
export type DCModuleConfig = ModuleConfig & {
  translation?: TranslationObject
  interactions?: Record<string, (interaction:Discord.Interaction) => void>
  events?: DCModuleEvent
  slashCommands?: Scope
}

export class DCCmdExecutor extends Executor<ModuleCmdCtx> {}
export class DCExecutor extends Executor<ModuleCtx> {}
export class DCFilter extends Filter<ModuleCtx> {}
export class DCScope extends Scope {}

export default class DCModule extends Module<ModuleCtx> {
  translation: TranslationObject = {}
  interactions: Record<string, (interaction:Discord.Interaction) => void> = {}
  events: DCModuleEvent = {}
  slashCommands: Record<string, DCCmdExecutor> = {}

  constructor( config:DCModuleConfig ) {
    super( config )
    DCModule.#merge( this, config )
  }

  static #merge( target:DCModule, module:DCModuleConfig ) {
    if (module.translation) Object.assign( target.translation, module.translation )
    if (module.events) Object.assign( target.events, module.events )
    if (module.slashCommands) Object.assign( target.slashCommands, module.slashCommands )

    Object.assign( target.interactions, module.interactions )
  }
}
