type ProcessorParam = {
  message?: string,
  processFilters?: boolean
  processCommands?: boolean
  filtersVariablesGetter?: (matches:string[]) => void
  commandsVariablesGetter?: () => void
  performResponse?: () => void
  checkPermissions?: () => void
}

export default class GuildDataset {
  processMessage({ message, processFilters = true, processCommands = true, ...functions }:ProcessorParam) {
    if (processFilters) console.log( `checking filteres`, { message } )
    if (processCommands) {
      console.log( `checking commands`, { message } )
    }
  }
}
