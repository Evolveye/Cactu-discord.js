import { ExecutorParam } from "../Scope.js"
import { ProcessorNode } from "."

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
export class RuntimeExecutionError extends ExecutionError {}
