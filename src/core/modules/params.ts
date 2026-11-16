import { ExecutionError, MissingExecutionParameter, OverlimitedExecutorParameter, WrongExecutionParameter } from "../namespaceStructure/ModuleProcessor/ExecutorError.js"
import type { ExecutorParam, ExecutorParamType } from "../namespaceStructure/Scope.js"

export type ParamKind = `string` | `number` | `bool` | `rest` | `pattern` | `mention` | `channel`

/** A typed parameter of a command, or a typed setting of a module */
export type Param<TValue = unknown> = {
  readonly kind: ParamKind
  readonly isOptional: boolean
  readonly defaultValue: undefined | TValue
  readonly description: undefined | string
  readonly regex: undefined | RegExp
  /** Converts a word of a text command (the whole remaining text for `rest`); undefined when it doesn't fit */
  readonly parseText: (text:string) => undefined | TValue
  /** Checks a ready value: a slash command option or a setting from JSON */
  readonly accepts: (value:unknown) => boolean
  optional: () => Param<undefined | TValue>
  default: (value:TValue) => Param<TValue>
  describe: (description:string) => Param<TValue>
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type ParamsShape = Record<string, Param<any>>
export type ParamsValues<TShape extends ParamsShape> = { [K in keyof TShape]:TShape[K] extends Param<infer TValue> ? TValue : never }

type ParamState<TValue> = Omit<Param<TValue>, `optional` | `default` | `describe`>

const TRUE_WORDS = /^(?:true|t|yes|y|1)$/i
const FALSE_WORDS = /^(?:false|f|no|n|0)$/i
const MENTION = /^<(?:@[!&]?|#)(\d+)>$/
const CHANNEL_MENTION = /^<#(\d+)>$/
const SNOWFLAKE = /^\d{17,20}$/

export function string() {
  return createParam<string>( `string`, text => text, value => typeof value === `string` )
}

export function number() {
  return createParam<number>( `number`, text => /^-?\d+(?:\.\d+)?$/.test( text ) ? Number( text ) : undefined, value => typeof value === `number` )
}

export function bool() {
  return createParam<boolean>( `bool`, parseBool, value => typeof value === `boolean` )
}

/** The rest of the message, spaces and new lines included */
export function rest() {
  return createParam<string>( `rest`, text => text || undefined, value => typeof value === `string` )
}

export function pattern( regex:RegExp ) {
  return createParam<string>( `pattern`, text => regex.test( text ) ? text : undefined, value => typeof value === `string` && regex.test( value ), regex )
}

/** A user, role or channel mention (or a bare ID); the value is the ID */
export function mention() {
  return createParam<string>( `mention`, text => text.match( MENTION )?.[ 1 ] ?? (SNOWFLAKE.test( text ) ? text : undefined), value => typeof value === `string` )
}

/** A channel mention (or a bare ID); the value is the ID */
export function channel() {
  return createParam<string>( `channel`, text => text.match( CHANNEL_MENTION )?.[ 1 ] ?? (SNOWFLAKE.test( text ) ? text : undefined), value => typeof value === `string` )
}

/** Parses a text command's parameters: words in order, an optional parameter that doesn't fit is skipped, `rest` takes the remaining text */
export function parseTextParams<TShape extends ParamsShape>( shape:TShape, text:string ): ExecutionError | ParamsValues<TShape> {
  const words = [ ...text.matchAll( /\S+/g ) ].map( match => ({ word:match[ 0 ], start:match.index }) )
  const values:Record<string, unknown> = {}
  let wordIndex = 0

  for (const [ name, param ] of Object.entries( shape )) {
    const word = words[ wordIndex ]
    const input = param.kind === `rest` && word ? text.slice( word.start ).trimEnd() : word?.word

    if (input === undefined) {
      if (!param.isOptional) return new MissingExecutionParameter({ param:toExecutorParam( name, param ) })

      values[ name ] = param.defaultValue
      continue
    }

    const value = param.parseText( input )

    if (value === undefined) {
      if (!param.isOptional) return new WrongExecutionParameter({ param:toExecutorParam( name, param ), passedValue:input })

      values[ name ] = param.defaultValue
      continue
    }

    values[ name ] = value
    wordIndex = param.kind === `rest` ? words.length : wordIndex + 1
  }

  const extraWord = words[ wordIndex ]
  if (extraWord) return new OverlimitedExecutorParameter({ passedValue:extraWord.word })

  return values as ParamsValues<TShape>
}

/** Checks ready values (slash command options, settings from JSON) by name, filling in the defaults */
export function parseValues<TShape extends ParamsShape>( shape:TShape, getValue:(name:string) => unknown ): ExecutionError | ParamsValues<TShape> {
  const values:Record<string, unknown> = {}

  for (const [ name, param ] of Object.entries( shape )) {
    const value = getValue( name )

    if (value === undefined || value === null) {
      if (!param.isOptional) return new MissingExecutionParameter({ param:toExecutorParam( name, param ) })

      values[ name ] = param.defaultValue
      continue
    }

    if (!param.accepts( value )) return new WrongExecutionParameter({ param:toExecutorParam( name, param ), passedValue:String( value ) })

    values[ name ] = value
  }

  return values as ParamsValues<TShape>
}

/** The parameter in the shape the processor's help, errors and slash registration read */
export function toExecutorParam( name:string, param:Param ): ExecutorParam {
  return { name, type:toExecutorParamType( param ), optional:param.isOptional, desc:param.description, defaultValue:param.defaultValue }
}

function createParam<TValue>( kind:ParamKind, parseText:(text:string) => undefined | TValue, accepts:(value:unknown) => boolean, regex?:RegExp ) {
  return buildParam<TValue>({ kind, isOptional:false, defaultValue:undefined, description:undefined, regex, parseText, accepts })
}

function buildParam<TValue>( state:ParamState<TValue> ): Param<TValue> {
  return {
    ...state,
    optional: () => buildParam<undefined | TValue>({ ...state, isOptional:true }),
    default: value => buildParam<TValue>({ ...state, isOptional:true, defaultValue:value }),
    describe: description => buildParam<TValue>({ ...state, description }),
  }
}

function toExecutorParamType( param:Param ): ExecutorParamType {
  if (param.kind === `rest`) return `message`
  if (param.kind === `pattern` && param.regex) return param.regex
  if (param.kind === `number` || param.kind === `bool` || param.kind === `mention`) return param.kind

  return `string`
}

function parseBool( text:string ) {
  if (TRUE_WORDS.test( text )) return true
  if (FALSE_WORDS.test( text )) return false

  return undefined
}
