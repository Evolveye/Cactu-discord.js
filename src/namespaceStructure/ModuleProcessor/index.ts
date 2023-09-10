import { Executor, Filter, Scope } from "../index.js"
import { FilterContext } from "../Filter.js"
import { ExecutionError } from "./ExecutorError.js"
import { CommandPermissionsError, CommandError, NoCommandError } from "./CommandError.js"

export * from "./CommandError.js"
export * from "./ExecutorError.js"

export type ProcessorNode = { path: string[];restPath: string; typeInstance: Executor | Scope }
export type ProcessorPermissionChecker = (perms:string[]) => boolean
export type ProcessorResponseHandlerParam = CommandError | ExecutionError | ProcessorNode
export type ProcessorResponseHandler = (response:ProcessorResponseHandlerParam) => void
export type ConditionalFilter = Filter | Filter[]

export type ProcessConfig<T=unknown> = {
  prefix?: null | string
  checkPermissions?: ProcessorPermissionChecker
  executorDataGetter?: () => T
  handleResponse?: ProcessorResponseHandler
}

export default class ModuleProcessor {
  async processCommand( command:string, scope:Scope, { prefix, executorDataGetter, checkPermissions, handleResponse }:ProcessConfig = {} ) {
    if (prefix) {
      if (command !== prefix.trimEnd() && !command.startsWith( prefix )) return

      command = command.slice( prefix.length )
    }

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

  async applyFilters( message:string, filters:ConditionalFilter[], executorDataGetter?:() => unknown ) {
    const filteringCtx:FilterContext = {
      breakFiltering: false,
      continueFilteringGroup: false,
      filterMatched: false,
    }

    let ctx:unknown = typeof executorDataGetter === `function` ? undefined : executorDataGetter

    for (const semiFiltersGroup of filters) {
      const filtersGroup = Array.isArray( semiFiltersGroup ) ? semiFiltersGroup : [ semiFiltersGroup ]

      filteringCtx.continueFilteringGroup = false
      filteringCtx.filterMatched = false

      for (const filter of filtersGroup) {
        const testPassed = filter.test( message )

        if (!testPassed) continue
        if (!ctx) ctx = executorDataGetter?.()

        await filter.apply( message, ctx, filteringCtx )

        if (filteringCtx.filterMatched) { /* TODO */ }
        if (!filteringCtx.continueFilteringGroup) break
      }

      if (filteringCtx.breakFiltering) break
    }
  }
}
