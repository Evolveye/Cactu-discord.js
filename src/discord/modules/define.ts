import type { ChatInputCommandInteraction, Client, ClientEvents, Guild, GuildMember, Message, MessageComponentInteraction, MessageCreateOptions, MessagePayload, ModalSubmitInteraction, TextBasedChannel } from "discord.js"
import type DCModule from "../DiscordModule.js"
import type CactuDiscordBot from "../DiscordBot.js"
import type { TranslationObject } from "../../core/translations.js"
import type { Namespace } from "../../core/namespaceStructure/index.js"
import type { ParamsShape, ParamsValues } from "../../core/modules/params.js"
import type { HttpAnswer, HttpRequest } from "../../core/http/HttpServer.js"
import type FileStorage from "../../core/FileStorage/index.js"

/** What every context has: the whole Discord API, plus this module's settings and storage in this namespace */
export type BaseCtx<TSettings extends ParamsShape = {}> = {
  client: Client
  bot: CactuDiscordBot
  namespace: Namespace<DCModule>
  guild: null | Guild
  settings: ParamsValues<TSettings>
  /** This module's own storage in this namespace */
  storage: () => Promise<FileStorage>
}

export type SendContent = string | MessagePayload | MessageCreateOptions

export type MessageCommandCtx<TSettings extends ParamsShape = {}> = BaseCtx<TSettings> & {
  source: `message`
  message: Message
  channel: TextBasedChannel
  member: null | GuildMember
  send: (content:SendContent) => Promise<unknown>
  runCommand: (command:string) => Promise<void>
}

export type SlashCommandCtx<TSettings extends ParamsShape = {}> = BaseCtx<TSettings> & {
  source: `slash`
  interaction: ChatInputCommandInteraction
  channel: null | TextBasedChannel
  member: null | GuildMember
  /** Replies; once replied (or deferred), edits or follows up */
  send: (content:SendContent) => Promise<unknown>
  runCommand: (command:string) => Promise<void>
}

/** A command can always be reached both ways: `runCommand` from a slash command runs text commands too */
export type CommandCtx<TSettings extends ParamsShape = {}> = MessageCommandCtx<TSettings> | SlashCommandCtx<TSettings>

export type FilterCtx<TSettings extends ParamsShape = {}> = BaseCtx<TSettings> & {
  message: Message
  channel: TextBasedChannel
  member: null | GuildMember
  /** The match of a RegExp filter */
  match: null | RegExpMatchArray
  send: (content:SendContent) => Promise<unknown>
  runCommand: (command:string) => Promise<void>
  /** No later filter (group) runs for this message */
  stopFiltering: () => void
  /** The next filter of the same group runs too */
  continueGroup: () => void
}

export type ComponentCtx<TSettings extends ParamsShape = {}> = BaseCtx<TSettings> & {
  interaction: MessageComponentInteraction | ModalSubmitInteraction
  /** The match of a `/regex/` customId key */
  match: null | RegExpMatchArray
}

export type EventCtx<TSettings extends ParamsShape = {}> = BaseCtx<TSettings>

export type EndpointCtx<TSettings extends ParamsShape = {}> = BaseCtx<TSettings> & {
  request: HttpRequest
}

/** Answers with a status, or `{ status, body }` for a JSON body; it should answer quickly and do slow work afterwards */
export type EndpointHandler<TSettings extends ParamsShape = {}> = (ctx:EndpointCtx<TSettings>) => HttpAnswer | Promise<HttpAnswer>

/** A cleanup undoes what the setup started (intervals, listeners…) before the module reloads */
export type ModuleSetup<TSettings extends ParamsShape = {}> = (ctx:EventCtx<TSettings>) => unknown | (() => unknown) | Promise<unknown | (() => unknown)>

export type CommandDefinition<TSettings extends ParamsShape = {}, TParams extends ParamsShape = {}> = {
  kind: `command`
  description?: string
  perms: string[]
  params: TParams
  /** Reachable as a text command (`<prefix><name>`) */
  message: boolean
  /** Registered as a slash command; only for commands at the root of `commands` */
  slash: boolean
  run: (ctx:CommandCtx<TSettings>, params:ParamsValues<TParams>) => unknown
}

export type GroupDefinition = {
  kind: `group`
  description?: string
  perms: string[]
  commands: CommandsTree
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type CommandsTree = Record<string, CommandDefinition<any, any> | GroupDefinition>

/**
 * Decides whether a filter applies to a message, with the whole context at hand (message, channel, member, settings, the API).
 * `true` or a RegExp match applies it (the match becomes `ctx.match`); `false` or `null` doesn't: no call, no log line.
 */
export type FilterMatcher<TSettings extends ParamsShape = {}> = (ctx:Omit<FilterCtx<TSettings>, `match`>) => boolean | null | RegExpMatchArray

export type FilterDefinition<TSettings extends ParamsShape = {}> = {
  kind: `filter`
  /** A RegExp tested on the message text, or logic over the whole context */
  match: RegExp | FilterMatcher<TSettings>
  run: (ctx:FilterCtx<TSettings>) => unknown
}

/** Filters run in order; in a group (array), only the first matching one runs unless it calls `continueGroup` */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type FiltersList = (FilterDefinition<any> | FilterDefinition<any>[])[]

export type EventsDefinition<TSettings extends ParamsShape = {}> = {
  [K in keyof ClientEvents]?:(...args:[ ...ClientEvents[K], EventCtx<TSettings> ]) => unknown
}

export type ModuleDefinition<TSettings extends ParamsShape = {}> = {
  kind: `module`
  settings: TSettings
  commands: CommandsTree
  filters: FiltersList
  /** customId (or `/regex/`) → handler of buttons, selects and modals */
  components: Record<string, (ctx:ComponentCtx<TSettings>) => unknown>
  /** Client events, delivered only when they concern this namespace's guild (or no guild at all) */
  events: EventsDefinition<TSettings>
  /** `METHOD /path` → handler, served by the bot's HTTP server (`http` in the bot's config) at `METHOD /api/<namespace id>/<module name>/<path>` while the module is loaded */
  endpoints: Record<string, EndpointHandler<TSettings>>
  /** Runs when the module starts in a namespace, again after every reload; its returned cleanup runs before each reload */
  setup: null | ModuleSetup<TSettings>
  translation: TranslationObject
}

/** A module with any settings: what the loader and the compiler handle */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type AnyModuleDefinition = ModuleDefinition<any>

export type ModuleDefinitionConfig<TSettings extends ParamsShape> = Partial<Omit<ModuleDefinition<TSettings>, `kind` | `settings`>>

type CommandConfig<TSettings extends ParamsShape, TParams extends ParamsShape> = {
  description?: string
  perms?: string | string[]
  params?: TParams
  message?: boolean
  slash?: boolean
  run: (ctx:CommandCtx<TSettings>, params:ParamsValues<TParams>) => unknown
}

type GroupConfig = {
  description?: string
  perms?: string | string[]
  commands: CommandsTree
}

/**
 * Builders bound to a module's settings, so `ctx.settings` is typed in every file of a multi-file module.
 * Without settings, use the ready builders exported below (`defineModule`, `command`…).
 */
export function createModuleKit<TSettings extends ParamsShape = {}>( settings:TSettings = {} as TSettings ) {
  return {
    settings,
    defineModule: (config:ModuleDefinitionConfig<TSettings>): ModuleDefinition<TSettings> => ({
      kind: `module`,
      settings,
      commands: config.commands ?? {},
      filters: config.filters ?? [],
      components: config.components ?? {},
      events: config.events ?? {},
      endpoints: config.endpoints ?? {},
      setup: config.setup ?? null,
      translation: config.translation ?? {},
    }),
    command: <TParams extends ParamsShape = {}>( config:CommandConfig<TSettings, TParams> ): CommandDefinition<TSettings, TParams> => ({
      kind: `command`,
      description: config.description,
      perms: toArray( config.perms ),
      params: config.params ?? {} as TParams,
      message: config.message ?? true,
      slash: config.slash ?? false,
      run: config.run,
    }),
    group: (config:GroupConfig): GroupDefinition => ({ kind:`group`, description:config.description, perms:toArray( config.perms ), commands:config.commands }),
    filter: (match:FilterDefinition<TSettings>[ `match` ], run:FilterDefinition<TSettings>[ `run` ]): FilterDefinition<TSettings> => ({ kind:`filter`, match, run }),
  }
}

export const { defineModule, command, group, filter } = createModuleKit()

export function isModuleDefinition( value:unknown ): value is AnyModuleDefinition {
  return typeof value === `object` && value !== null && (value as { kind?: unknown }).kind === `module`
}

function toArray( perms:undefined | string | string[] ) {
  if (!perms) return []
  return Array.isArray( perms ) ? perms : [ perms ]
}
