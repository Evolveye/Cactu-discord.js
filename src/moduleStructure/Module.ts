import Scope from "./Scope.js"
import Filter from "./Filter.js"

export interface ModuleData {
  prefix: string
  prefixSpace: boolean
  translation: Record<string, string>
  commands: undefined | Scope
  filters: Filter[]
}

export type ModuleConfig = Partial<ModuleData>

export default class Module implements ModuleData {
  prefix = `/`
  prefixSpace = false
  translation = {}
  commands: undefined | Scope = undefined
  filters = []

  constructor( config:ModuleConfig = {} ) {
    Module.merge( this, config )
  }

  static merge( target:Module, module:ModuleConfig ) {
    if (module.prefix) target.prefix = module.prefix
    if (module.prefixSpace) target.prefixSpace = module.prefixSpace
    if (module.filters) module.filters.push( ...module.filters )
    if (module.translation) Object.assign( target.translation, module.translation )

    if (module.commands) {
      if (target.commands) Scope.merge( target.commands, module.commands )
      else target.commands = module.commands
    }
  }
}
