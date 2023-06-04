import Discord from "discord.js"
import { Executor, Filter, Module, ModuleConfig, Scope } from "../moduleStructure/index.js"
import Namespace from "../Namespace.js"

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
  | `label.commands`
  | `label.scopes`
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

export type DCModuleConfig = ModuleConfig & {
  translation: TranslationObject
  interactions: Record<string, (interaction:Discord.Interaction) => void>
}

export class DCExecutor extends Executor<ModuleCtx> {}
export class DCFilter extends Filter<ModuleCtx> {}
export class DCScope extends Scope {}
export default class DCModule extends Module<ModuleCtx> {
  translation: TranslationObject = {}
  interactions: Record<string, (interaction:Discord.Interaction) => void> = {}

  constructor( config:DCModuleConfig ) {
    super( config )
    DCModule.#merge( this, config )
  }

  static #merge( target:DCModule, module:DCModuleConfig ) {
    if (module.translation) Object.assign( target.translation, module.translation )
    Object.assign( target.interactions, module.interactions )
  }
}
