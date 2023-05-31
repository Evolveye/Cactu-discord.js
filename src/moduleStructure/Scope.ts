export type BasicUnnormalizedMetadata = {
  p?: string | string[]
  perms?: string | string[]
  sd?: string
  shortDescription?: string
  dd?: string
  detailedDescription?: string
}

export type BasicMetadata = {
  perms?: string[]
  shortDescription?: string
  detailedDescription?: string
}

export type ExecutorParamType = `bool` | `number` | `string` | `message` | {min: number; max: number} | string[]
export type ExecutorParam = {
  name: string
  desc?: string
  type: ExecutorParamType
}

export type ExecutorMetaData = BasicUnnormalizedMetadata & {
  params: ExecutorParam[]
}

export class MetadataHolder {
  #meta: BasicMetadata

  constructor( meta:BasicUnnormalizedMetadata ) {
    let perms = meta.p ?? meta.perms ?? []
    if (!Array.isArray( perms )) perms = [ perms ]

    this.#meta = {
      perms,
      detailedDescription: meta.dd ?? meta.detailedDescription,
      shortDescription: meta.sd ?? meta.shortDescription,
    }
  }

  get meta() {
    return this.#meta
  }
}

export type ExecutorFn<T=unknown> = (context:T) => void
export class Executor<T=unknown> extends MetadataHolder {
  #fn: ExecutorFn<T>

  constructor( meta:BasicUnnormalizedMetadata, fn:ExecutorFn<T> ) {
    super( meta )
    this.#fn = fn
  }

  execute( ctx:T ) {
    this.#fn( ctx )
  }
}

export type ScopeConfig = Record<string, Scope | Executor>
export default class Scope extends MetadataHolder {
  config: ScopeConfig

  constructor( meta:BasicUnnormalizedMetadata, config:ScopeConfig ) {
    super( meta )
    this.config = config
  }

  getItem( fieldName:string ) {
    return this.config[ fieldName ]
  }

  getItemsInfo() {
    return Object.entries( this.config ).map( ([ name, { meta } ]) => ({ name, ...meta }) )
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
