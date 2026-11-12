import Scope from "./namespaceStructure/Scope.js"
import { ExecutionError, MissingExecutionParameter, OverlimitedExecutorParameter, RuntimeExecutionError, WrongExecutionParameter } from "./namespaceStructure/ModuleProcessor/ExecutorError.js"
import { CommandError, CommandPermissionsError, NoCommandError } from "./namespaceStructure/ModuleProcessor/CommandError.js"
import type { TranslationObject } from "./translations.js"
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

export type HelpResponse = {
  type: `help`
  title: string
  prefix: string
  path: string[]
  /** How to read the help, shown at the root scope only */
  notes: string[]
  labels: { scopes: string, commands: string, nothing: string }
  scopes: HelpEntry[]
  commands: HelpEntry[]
}

export type ProcessorResponse = ErrorResponse | HelpResponse

/** Returns null for responses nobody has to see (e.g. a successfully executed command) */
export function describeResponse( response:ProcessorResponseHandlerParam, translation:TranslationObject, prefix:string ): null | ProcessorResponse {
  if (response instanceof Error) return describeError( response, translation )
  if (response.typeInstance instanceof Scope) return describeHelp( response.typeInstance, response.path, translation, prefix )

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

function describeHelp( scope:Scope, path:string[], t:TranslationObject, prefix:string ): HelpResponse {
  const scopes:HelpEntry[] = []
  const commands:HelpEntry[] = []

  for (const item of scope.getItemsInfo()) {
    const description = item.shortDescription ?? ``

    if (item.type === `scope`) scopes.push({ name:item.name, description, params:[] })
    if (item.type === `executor` && `params` in item) commands.push({
      name: item.name,
      description,
      params: item.params.map( param => ({ name:param.name, optional:!!param.optional, rest:param.type === `message` }) ),
    })
  }

  const notes = path.length ? [] : [
    t[ `help.optionalParam` ] ?? `Sign **\`?\`** means parameter is optional`,
    t[ `help.restParam` ] ?? `Dots **\`...\`** means parameter can be a sentence`,
  ]

  return {
    type: `help`,
    title: t[ `help.title` ] ?? `⚙️ Help for commands`,
    prefix,
    path,
    notes,
    labels: {
      scopes: t[ `help.scopes` ] ?? `Scopes`,
      commands: t[ `help.commands` ] ?? `Commands`,
      nothing: t[ `help.nothing` ] ?? `Nothing is here`,
    },
    scopes,
    commands,
  }
}
