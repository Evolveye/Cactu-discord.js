import Discord from "discord.js"
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

export type TranslationObject = Partial<Record<TranslationKeys, string>>

export type ModuleCtx = {
  ns: Namespace<DCModule>
  msg: Discord.Message
  send: (msg:string | Discord.MessagePayload | Discord.MessageCreateOptions) => (Promise<Discord.Message<false>> | Promise<Discord.Message<true>>)
  sendOk: (msg:string) => (Promise<Discord.Message<false>> | Promise<Discord.Message<true>>)
  deleteMsg: () => Promise<Discord.Message<boolean>>
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

export class DCExecutor extends Executor<ModuleCtx> {}
export class DCFilter extends Filter<ModuleCtx> {}
export class DCScope extends Scope {}

export default class DCModule extends Module<ModuleCtx> {
  translation: TranslationObject = {}
  interactions: Record<string, (interaction:Discord.Interaction) => void> = {}
  events: DCModuleEvent = {}
  slashCommands: undefined | Scope = undefined

  constructor( config:DCModuleConfig ) {
    super( config )
    DCModule.#merge( this, config )
  }

  static #merge( target:DCModule, module:DCModuleConfig ) {
    if (module.translation) Object.assign( target.translation, module.translation )
    if (module.events) Object.assign( target.events, module.events )

    if (module.slashCommands) {
      if (target.slashCommands) Scope.merge( target.slashCommands, module.slashCommands )
      else target.slashCommands = module.slashCommands
    }

    Object.assign( target.interactions, module.interactions )
  }
}
