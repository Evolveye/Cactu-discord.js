import { Executor, Scope } from "./moduleStructure/index.js"

export default class CommandsProcessor {
  process( command:string, scope:Scope, executorDataGetter?:() => unknown ) {
    const trimedCmd = command.trim()
    const node = this.#findNode( trimedCmd, scope )

    if (!node) return

    if (node.typeInstance instanceof Executor) node.typeInstance.execute( executorDataGetter?.() )
    else console.log( node.typeInstance.getItemsInfo() )
  }

  #findNode( command:string, scope:Scope ) {
    const commandPartRegExp = /[^ ]+/g
    const path:string[] = []
    let part:undefined | string = undefined
    let typeInstance:undefined | Scope | Executor = scope

    while ((part = commandPartRegExp.exec( command )?.[ 0 ])) {
      path.push( part )
      typeInstance = typeInstance.getItem( part )

      if (!typeInstance) return
      if (typeInstance instanceof Executor) break
    }

    if (!typeInstance) return

    return { path, typeInstance }
  }
}
