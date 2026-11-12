export type CommandProcessingErrorConfig = {
  path: string[]
  restPath: string
  command: string
}

export class CommandError extends Error {
  path: string[]
  restPath: string
  command: string

  constructor({ path, command, restPath }:CommandProcessingErrorConfig) {
    super()
    this.path = path
    this.restPath = restPath
    this.command = command
  }
}

export class CommandPermissionsError extends CommandError {}
export class NoCommandError extends CommandError {}
