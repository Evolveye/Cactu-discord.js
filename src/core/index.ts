/* Cactu core: communicator-agnostic namespaces, modules, commands, filters, storage and logging. Never imports a communicator's SDK. */

export { default as BotClientBase } from "./BotClientBase.js"
export * from "./BotClientBase.js"

export * from "./namespaceStructure/index.js"
export type { ExecutorParam, ExecutorParamType, ExecutorFn, ScopeConfig } from "./namespaceStructure/Scope.js"
export type { FilterContext, FilterTester, FilterEvaluator } from "./namespaceStructure/Filter.js"

export * from "./translations.js"
export * from "./responses.js"

export { default as FileStorage } from "./FileStorage/index.js"
export { default as Logger } from "./logger/index.js"
export { default as ModulesManager } from "./ModulesManager.js"
