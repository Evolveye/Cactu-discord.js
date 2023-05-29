export type ScopeMeta = {
  r?: string | string[]
  roles?: string | string[]
  sd?: string
  shortDescription?: string
  dd?: string
  detailedDescription?: string
}

export type ExecutorFn = () => void
export class Executor {
  #meta: ScopeMeta
  #fn: ExecutorFn

  get meta() {
    return this.#meta
  }

  constructor( meta:ScopeMeta, fn:ExecutorFn ) {
    this.#meta = meta
    this.#fn = fn
  }

  execute = () => {
    this.#fn()
  }
}

export type ScopeConfig = Record<string, Scope | Executor>
export default class Scope {
  #meta: ScopeMeta
  config: ScopeConfig

  get meta() {
    return this.#meta
  }

  constructor( meta:ScopeMeta, config:ScopeConfig ) {
    this.#meta = meta
    this.config = config
  }

  static merge( target:Scope, scope:Scope ) {
    Object.entries( scope ).forEach( ([ key, value ]) => {
      if (key in target) {
        if (target[ key ] instanceof Executor) target[ key ] = value
        else if (target[ key ] instanceof Scope) {
          if (value instanceof Scope) this.merge( target[ key ], value )
        }
      }

      target[ key ] = value
    } )
  }
}
