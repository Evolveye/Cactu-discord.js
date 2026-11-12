/* Cactu's Discord communicator: the only part of the project allowed to import discord.js */

export { default, default as CactuDiscordBot } from "./DiscordBot.js"
export type { Config } from "./DiscordBot.js"

export { default as DCModule } from "./DiscordModule.js"
export * from "./DiscordModule.js"

export { getWebHook } from "./webhooks.js"
export { checkPermissions } from "./permissions.js"
export type { ResponseTarget } from "./responses.js"
export type { GlobalCommandData } from "./handlers/slashCommands.js"
