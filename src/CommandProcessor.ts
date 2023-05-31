import { Executor, Scope } from "./moduleStructure/index.js"

export class CommandProcessingError extends Error {
  path: string[]

  constructor( path:string[] ) {
    super()
    this.path = path
  }
}
export class CommandPermissionsError extends CommandProcessingError {}

export type ProcessorPermissionChecker = (perms:string[]) => boolean
export type ProcessorResponseHandlerParam = CommandPermissionsError
export type ProcessorResponseHandler = (response:ProcessorResponseHandlerParam) => void

export type ProcessConfig<T=unknown> = {
  checkPermissions?: ProcessorPermissionChecker
  executorDataGetter?: () => T
  handleResponse?: ProcessorResponseHandler
}

export default class CommandsProcessor {
  process( command:string, scope:Scope, { executorDataGetter, checkPermissions, handleResponse }:ProcessConfig = {} ) {
    const trimedCmd = command.trim()
    const node = this.#findNode( trimedCmd, scope, checkPermissions )

    if (!node) return
    if (node instanceof Error) {
      if (node instanceof CommandPermissionsError) handleResponse?.( node )
      return
    }

    if (node.typeInstance instanceof Executor) node.typeInstance.execute( executorDataGetter?.() )
    else console.log( node.typeInstance.getItemsInfo() )
  }

  #findNode( command:string, scope:Scope, checkPermissions?:ProcessorPermissionChecker ) {
    const commandPartRegExp = /[^ ]+/g
    const path:string[] = []
    let part:undefined | string = undefined
    let typeInstance:undefined | Scope | Executor = scope

    while ((part = commandPartRegExp.exec( command )?.[ 0 ])) {
      path.push( part )
      typeInstance = typeInstance.getItem( part )

      if (!typeInstance) return

      const { perms } = typeInstance.meta

      if (perms && !checkPermissions?.( perms )) return new CommandPermissionsError( path )
      if (typeInstance instanceof Executor) break
    }

    if (!typeInstance) return

    return { path, typeInstance }
  }
}
