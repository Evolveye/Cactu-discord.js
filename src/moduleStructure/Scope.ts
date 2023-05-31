export type BasicMetadata = {
  r?: string | string[]
  roles?: string | string[]
  sd?: string
  shortDescription?: string
  dd?: string
  detailedDescription?: string
}

export type ExecutorParamType = `bool` | `number` | `string` | `message` | {min: number; max: number} | string[]
export type ExecutorParam = {
  name: string
  desc?: string
  type: ExecutorParamType
}

export type ExecutorMetaData = BasicMetadata & {
  params: ExecutorParam[]
}

export class MetadataHolder {
  #meta: BasicMetadata

  constructor( meta:BasicMetadata ) {
    this.#meta = meta
  }

  get meta() {
    return this.#meta
  }
}

export type ExecutorFn = (context:unknown) => void
export class Executor extends MetadataHolder {
  #fn: ExecutorFn

  constructor( meta:BasicMetadata, fn:ExecutorFn ) {
    super( meta )
    this.#fn = fn
  }

  execute( ctx ) {
    this.#fn( ctx )
  }
}

export type ScopeConfig = Record<string, Scope | Executor>
export default class Scope extends MetadataHolder {
  config: ScopeConfig

  constructor( meta:BasicMetadata, config:ScopeConfig ) {
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
