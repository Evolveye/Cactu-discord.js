import MetadataHolder, { UnnormalizedMeta } from "./ModuleStructureMeta.js"
import { MissingExecutionParameter, OverlimitedExecutorParameter, RuntimeExecutionError, WrongExecutionParameter } from "./ModuleProcessor/index.js"

export type ExecutorParamType = `bool` | `number` | `string` | `message` | {min: number; max: number} | RegExp | string[]
export type ExecutorParam = {
  name: string
  desc?: string
  type: ExecutorParamType
  optional?: boolean
}

export type OnlyExecutorMetaData = {
  params: ExecutorParam[]
}

export type ExecutorPartialMeta = UnnormalizedMeta & Partial<OnlyExecutorMetaData>
export type ExecutorMeta = UnnormalizedMeta & OnlyExecutorMetaData

export type ExecutorFn<T = unknown> = (context:T, ...params:unknown[]) => void | Promise<void>
export class Executor<T = unknown> extends MetadataHolder<ExecutorMeta> {
  #fn: ExecutorFn<T>

  constructor( meta:ExecutorPartialMeta, fn:ExecutorFn<T> ) {
    if (!Array.isArray( meta.params )) meta.params = []

    super( meta as ExecutorMeta, `executor` )
    this.#fn = fn
  }

  async execute( params:unknown[], ctx:T ) {
    try {
      await this.#fn( ctx, ...params )
    } catch (err) {
      return new RuntimeExecutionError( err )
    }
  }

  prepareParams( paramsString:string ) {
    const paramsRegExp = /[^ ]+/g
    const paramsValues:(undefined | boolean | number | string)[] = []
    let lastNoOptionalRegIndex = 0

    for (const param of this.meta.params) {
      let part = paramsRegExp.exec( paramsString )?.[ 0 ]

      if (!part) {
        if (!param.optional) return new MissingExecutionParameter({ param })
        paramsRegExp.lastIndex = lastNoOptionalRegIndex
        continue
      }

      let testPass = false

      if (param.type == `number`) testPass = /^-?\d+$/.test( part )
      else if (param.type == `string`) testPass = /^[^ ]+$/.test( part )
      else if (param.type == `bool`) testPass = /^(?:true|t|yes|y|1|false|f|no|n|0)$/i.test( part )
      else if (param.type instanceof RegExp) testPass = param.type.test( part )
      else if (param.type == `message`) {
        testPass = /^.+$/s.test( part )
        part += paramsString.slice( paramsRegExp.lastIndex )
        paramsRegExp.lastIndex = Infinity
      }

      if (!testPass) {
        if (!param.optional) return new WrongExecutionParameter({ param, passedValue:part })
        paramsValues.push( undefined )
        paramsRegExp.lastIndex = lastNoOptionalRegIndex
        continue
      }

      lastNoOptionalRegIndex = paramsRegExp.lastIndex
      paramsValues.push( part )
    }

    const overlimited = paramsRegExp.exec( paramsString )?.[ 0 ]
    if (overlimited) return new OverlimitedExecutorParameter({ passedValue:overlimited })

    return paramsValues
  }

  async prepareAndExecute( paramsString:string, ctx:T ) {
    const params = this.prepareParams( paramsString )

    if (Array.isArray( params )) return this.execute( params, ctx )
    else return params
  }
}


export type ScopeConfig = Record<string, Scope | Executor>
export default class Scope extends MetadataHolder {
  config: ScopeConfig

  constructor( meta:UnnormalizedMeta, config:ScopeConfig ) {
    super( meta, `scope` )
    this.config = config
  }

  getItem( fieldName:string ) {
    return this.config[ fieldName ]
  }

  getItemsInfo() {
    return Object.entries( this.config ).map( ([ name, { meta } ]) => ({ name, ...meta }) )
  }

  static merge( target:Scope, scope:Scope ) {
    Object.entries( scope.config ).forEach( ([ key, value ]) => {
      const targetConf = target.config

      if (key in targetConf) {
        if (targetConf[ key ] instanceof Executor) targetConf[ key ] = value
        else if (targetConf[ key ] instanceof Scope) {
          if (value instanceof Scope) this.merge( targetConf[ key ] as Scope, value )
        }
      } else targetConf[ key ] = value
    } )
  }
}
