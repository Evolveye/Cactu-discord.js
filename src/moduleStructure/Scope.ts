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
  #config: ScopeConfig

  get meta() {
    return this.#meta
  }

  constructor( meta:ScopeMeta, config:ScopeConfig ) {
    this.#meta = meta
    this.#config = config
  }
}
