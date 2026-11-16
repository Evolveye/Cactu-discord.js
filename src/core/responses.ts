import Scope, { Executor } from "./namespaceStructure/Scope.js"
import { ExecutionError, MissingExecutionParameter, OverlimitedExecutorParameter, RuntimeExecutionError, WrongExecutionParameter } from "./namespaceStructure/ModuleProcessor/ExecutorError.js"
import { CommandError, CommandPermissionsError, NoCommandError } from "./namespaceStructure/ModuleProcessor/CommandError.js"
import type { TranslationObject } from "./translations.js"
import type { ExecutorParam } from "./namespaceStructure/Scope.js"
import type { ProcessorResponseHandlerParam } from "./namespaceStructure/ModuleProcessor/index.js"

export type ErrorResponse = {
  type: `error`
  title: string
  description: string
  /** The command path, when the error happened while looking for the command */
  path: null | string[]
  /** Set when the command's own code threw, so a communicator can log it */
  runtimeError: null | RuntimeExecutionError
}

export type HelpParam = {
  name: string
  optional: boolean
  /** The parameter takes the rest of the message */
  rest: boolean
}

export type HelpEntry = {
  name: string
  description: string
  params: HelpParam[]
}

/** Checks a command's or a group's `perms` for the user asking for help */
export type AccessChecker = (perms:string[]) => boolean

export type CommandHelpParam = HelpParam & {
  description: string
  /** What a skipped optional parameter becomes, as text; null without a default */
  defaultValue: null | string
}

/** The help of one command (`… ?`): its usage, description and every parameter */
export type CommandHelpResponse = {
  type: `commandHelp`
  title: string
  description: string
  prefix: string
  path: string[]
  params: CommandHelpParam[]
  /** The meaning of the usage notation (required, optional, rest), one per line */
  notes: string[]
  labels: { params: string, required: string, optional: string, rest: string, default: string }
}

export type HelpResponse = {
  type: `help`
  title: string
  /** The scope's own description; empty at the root */
  description: string
  prefix: string
  path: string[]
  /** The meaning of the usage notation (required, optional, rest), one per line */
  notes: string[]
  /** How to see the help of a single command */
  commandHelpTip: string
  labels: { scopes: string, commands: string, nothing: string }
  scopes: HelpEntry[]
  commands: HelpEntry[]
}

export type ProcessorResponse = ErrorResponse | HelpResponse | CommandHelpResponse

/**
 * Returns null for responses nobody has to see (e.g. a successfully executed command).
 * With `canAccess`, the help lists only commands the user may run, and groups with at least one of them inside.
 */
export function describeResponse( response:ProcessorResponseHandlerParam, translation:TranslationObject, prefix:string, canAccess:AccessChecker = () => true ): null | ProcessorResponse {
  if (response instanceof Error) return describeError( response, translation )
  if (response.typeInstance instanceof Scope) return describeHelp( response.typeInstance, response.path, translation, prefix, canAccess )
  if (response.showHelp) return describeCommandHelp( response.typeInstance, response.path, translation, prefix )

  return null
}

function describeError( error:CommandError | ExecutionError, t:TranslationObject ): ErrorResponse {
  return {
    type: `error`,
    title: t[ `err.error` ] ?? `Error`,
    description: describeErrorReason( error, t ),
    path: error instanceof CommandError ? error.path : null,
    runtimeError: error instanceof RuntimeExecutionError ? error : null,
  }
}

function describeErrorReason( error:CommandError | ExecutionError, t:TranslationObject ) {
  if (error instanceof NoCommandError) return t[ `err.noPath` ] ?? `No command`
  if (error instanceof CommandPermissionsError) return t[ `err.noPerms` ] ?? `You have no permissions to do this`
  if (error instanceof MissingExecutionParameter) return t[ `err.noParam` ] ?? `Missing parameter`
  if (error instanceof WrongExecutionParameter) return t[ `err.badParam` ] ?? `Bad parameter`
  if (error instanceof OverlimitedExecutorParameter) return t[ `err.tooManyParams` ] ?? `Too many parameters`
  if (error instanceof RuntimeExecutionError) return t[ `err.invalidCommand` ] ?? `This command has invalid code`

  return ``
}

function describeHelp( scope:Scope, path:string[], t:TranslationObject, prefix:string, canAccess:AccessChecker ): HelpResponse {
  const scopes:HelpEntry[] = []
  const commands:HelpEntry[] = []

  for (const [ name, item ] of Object.entries( scope.config )) {
    if (!isAccessible( item, canAccess )) continue

    const description = item.meta.shortDescription ?? ``

    if (item instanceof Scope) scopes.push({ name, description, params:[] })
    else commands.push({ name, description, params:item.meta.params.map( describeParam ) })
  }

  return {
    type: `help`,
    title: t[ `help.title` ] ?? `⚙️ Help for commands`,
    description: path.length ? scope.meta.shortDescription ?? `` : ``,
    prefix,
    path,
    notes: describeNotation( t ),
    commandHelpTip: t[ `help.showDescription` ] ?? `Add \`?\` at the end of a command to see its description and parameters`,
    labels: {
      scopes: t[ `help.scopes` ] ?? `Groups`,
      commands: t[ `help.commands` ] ?? `Commands`,
      nothing: t[ `help.nothing` ] ?? `Nothing is here`,
    },
    scopes,
    commands,
  }
}

function describeCommandHelp( executor:Executor, path:string[], t:TranslationObject, prefix:string ): CommandHelpResponse {
  return {
    type: `commandHelp`,
    title: t[ `help.title` ] ?? `⚙️ Help for commands`,
    description: executor.meta.detailedDescription ?? executor.meta.shortDescription ?? ``,
    prefix,
    path,
    params: executor.meta.params.map( param => ({
      ...describeParam( param ),
      description: param.desc ?? ``,
      defaultValue: param.defaultValue === undefined ? null : String( param.defaultValue ),
    }) ),
    notes: describeNotation( t ),
    labels: {
      params: t[ `help.params` ] ?? `Parameters`,
      required: t[ `label.required` ] ?? `required`,
      optional: t[ `label.optional` ] ?? `optional`,
      rest: t[ `label.rest` ] ?? `rest of the message`,
      default: t[ `label.default` ] ?? `default`,
    },
  }
}

function describeNotation( t:TranslationObject ) {
  return [
    t[ `help.requiredParam` ] ?? `\`<parameter>\` is required`,
    t[ `help.optionalParam` ] ?? `\`[parameter]\` is optional`,
    t[ `help.restParam` ] ?? `\`<parameter…>\` takes the rest of the message`,
  ]
}

/** A command the user may run, or a group the user may enter with at least one accessible command inside */
function isAccessible( item:Scope | Executor, canAccess:AccessChecker ): boolean {
  if (!canAccess( item.meta.perms ?? [] )) return false
  if (item instanceof Executor) return true

  return Object.values( item.config ).some( child => isAccessible( child, canAccess ) )
}

function describeParam( param:ExecutorParam ): HelpParam {
  return { name:param.name, optional:!!param.optional, rest:param.type === `message` }
}
