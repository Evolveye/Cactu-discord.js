import Scope from "./Scope.js"
import Filter from "./Filter.js"
import type { TranslationObject } from "../translations.js"

export type ModuleData<T = unknown> = {
  prefix: string
  commands: undefined | Scope
  filters: Filter<T>[]
  translation: TranslationObject
}

export type ModuleConfig<T = unknown> = Partial<ModuleData<T>>

export default class Module<T = unknown> implements ModuleData<T> {
  prefix = ``
  commands: undefined | Scope = undefined
  filters: Filter<T>[] = []
  translation: TranslationObject = {}

  constructor( config:ModuleConfig<T> = {} ) {
    Module.merge( this, config )
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  merge<T extends ModuleConfig<any>>(module:T) {
    Module.merge( this, module )
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  static merge( target:Module<any>, module:ModuleConfig<any> ) {
    if (module.prefix) target.prefix = module.prefix
    if (module.filters) target.filters.push( ...module.filters )
    if (module.translation) Object.assign( target.translation, module.translation )

    if (module.commands) {
      if (target.commands) Scope.merge( target.commands, module.commands )
      else target.commands = module.commands
    }
  }
}
