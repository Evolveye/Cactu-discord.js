import Scope from "./Scope.js"
import Filter from "./Filter.js"

export type TranslationKeys =
  | `err.noPath`
  | `err.noPerms`
  | `err.noParam`
  | `err.badParam`
  | `err.tooManyParams`
  | `err.tooManyParamsUnnecessaryParam`
  | `err.invalidCommand`
  | `err.error`
  | `err.noAttachment`
  | `help.title`
  | `help.showDescription`
  | `help.optionalParam`
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


export type ModuleConfig = {
  prefix?: string
  prefixSpace?: boolean
  translation?: Record<TranslationKeys, string>
  commands?: Scope
  filters?: Filter[]
}

export default class Module {
  constructor( config:ModuleConfig ) {

  }
}
