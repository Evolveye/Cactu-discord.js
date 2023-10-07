import { ExecutorParam } from "../Scope.js"
import { ProcessorNode } from "./index.js"

export type ExecutionErrorConfig = {
  param?: ExecutorParam
  passedValue?: string
  node?: ProcessorNode
}

export class ExecutionError extends Error {
  param: undefined | ExecutorParam
  passedValue: undefined | string
  node: undefined | ProcessorNode

  constructor( { param, passedValue, node }:ExecutionErrorConfig = {} ) {
    super()

    this.param = param
    this.node = node
    this.passedValue = passedValue
  }
}

export class MissingExecutionParameter extends ExecutionError {}
export class WrongExecutionParameter extends ExecutionError {}
export class OverlimitedExecutorParameter extends ExecutionError {}
export class RuntimeExecutionError extends ExecutionError {
  commandLocation: undefined | string = undefined

  constructor( err:unknown ) {
    super()

    if (err instanceof Error) {
      this.name = err.name
      this.message = err.message
      this.cause = err.cause
      this.stack = err.stack

      let line = err.stack?.match( /\n(.*)\n/ )?.[ 1 ]

      if (line && line.includes( `eval at <anonymous>` )) {
        this.commandLocation = line.split( `,` )[ 1 ]?.trim()
      }
    } else {
      this.cause = err
    }
  }
}
