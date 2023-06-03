import { Executor, Scope } from "../moduleStructure/index.js"
import { ExecutionError } from "./ExecutorError.js"
import { CommandPermissionsError, CommandError, NoCommandError } from "./CommandError.js"

export * from "./CommandError.js"
export * from "./ExecutorError.js"

export type ProcessorNode = { path: string[];restPath: string; typeInstance: Executor | Scope }
export type ProcessorPermissionChecker = (perms:string[]) => boolean
export type ProcessorResponseHandlerParam = CommandError | ExecutionError | ProcessorNode
export type ProcessorResponseHandler = (response:ProcessorResponseHandlerParam) => void

export type ProcessConfig<T=unknown> = {
  checkPermissions?: ProcessorPermissionChecker
  executorDataGetter?: () => T
  handleResponse?: ProcessorResponseHandler
}

export default class CommandsProcessor {
  async process( command:string, scope:Scope, { executorDataGetter, checkPermissions, handleResponse }:ProcessConfig = {} ) {
    const trimedCmd = command.trim()
    const node = this.#findNode( trimedCmd, scope, checkPermissions )

    if (node instanceof CommandError) {
      handleResponse?.( node )
      return
    }

    if (node.typeInstance instanceof Executor) {
      const executionResult = await node.typeInstance.prepareAndExecute( node.restPath, executorDataGetter?.() )

      if (executionResult) {
        if (executionResult instanceof ExecutionError) executionResult.node = node
        handleResponse?.( executionResult )
      }
    }

    return handleResponse?.( node as ProcessorNode )
  }

  #findNode( command:string, scope:Scope, checkPermissions?:ProcessorPermissionChecker ) {
    const commandPartRegExp = /[^ ]+/g
    let part:undefined | string = undefined
    let typeInstance:undefined | Scope | Executor = scope
    let data = {
      command,
      path: [] as string[],
      restPath: ``,
    }

    while ((part = commandPartRegExp.exec( command )?.[ 0 ])) {
      data.path.push( part )
      typeInstance = typeInstance.getItem( part )
      data.restPath = command.slice( commandPartRegExp.lastIndex )

      if (!typeInstance) return new NoCommandError( data )

      const { perms } = typeInstance.meta

      if (perms && !checkPermissions?.( perms )) return new CommandPermissionsError( data )
      if (typeInstance instanceof Executor) break
    }

    if (!typeInstance) return new NoCommandError( data )

    return {
      path: data.path,
      restPath: data.restPath.trim(),
      typeInstance,
    }
  }
}
