import { Guild, GuildMember, User } from "discord.js"
import DCModule, { DCCmdExecutor, DCExecutor, DCFilter, DCScope } from "../DiscordModule.js"
import { describeResponse } from "../../core/responses.js"
import { ExecutionError } from "../../core/namespaceStructure/ModuleProcessor/ExecutorError.js"
import { parseTextParams, parseValues, toExecutorParam } from "../../core/modules/params.js"
import type { APIInteractionGuildMember, Interaction, Message } from "discord.js"
import type { DCEndpoint, DCInteractionHandler, DCEventListener, ModuleCtx } from "../DiscordModule.js"
import type CactuDiscordBot from "../DiscordBot.js"
import type { Namespace } from "../../core/namespaceStructure/index.js"
import type { ExecutorParam, ScopeConfig } from "../../core/namespaceStructure/Scope.js"
import type { Param, ParamsShape } from "../../core/modules/params.js"
import type { HttpRequest } from "../../core/http/HttpServer.js"
import type FileStorage from "../../core/FileStorage/index.js"
import type { AnyModuleDefinition, BaseCtx, CommandCtx, CommandDefinition, CommandsTree, FilterDefinition, FiltersList, ModuleDefinition } from "./define.js"

export type CompileEnv = {
  bot: CactuDiscordBot
  namespace: Namespace<DCModule>
  guild: Guild
  moduleName: string
  prefix: string
  settings: Record<string, unknown>
  getStorage: () => Promise<FileStorage>
}

type AnyCommand = CommandDefinition<ParamsShape, ParamsShape>
type CallKind = `Command` | `Slash` | `Filter` | `Event` | `Component`
/** What a call came from: a message (its author), an interaction (its user), or only the user of an event */
type CallSource = Message | Interaction | { channel?: null, user: null | User }
type CreateBaseCtx = () => BaseCtx<ParamsShape>

/** `METHOD /path`, any case, slashes around the path optional */
const ENDPOINT_KEY = /^([a-z]+)\s+\/*([\w\-.~/]*?)\/*$/i

/** Text commands parse their typed, named parameters themselves, instead of the processor's positional text values */
class DefinedTextExecutor extends DCExecutor {
  #params: ParamsShape

  constructor( meta:ConstructorParameters<typeof DCExecutor>[ 0 ], params:ParamsShape, fn:ConstructorParameters<typeof DCExecutor>[ 1 ] ) {
    super( meta, fn )
    this.#params = params
  }

  prepareParams( paramsString:string ) {
    const parsed = parseTextParams( this.#params, paramsString )
    return (parsed instanceof ExecutionError ? parsed : [ parsed ]) as unknown as ReturnType<DCExecutor[ `prepareParams` ]>
  }
}

/** Turns a module definition into the processor's primitives (scopes, executors, filters); every call builds a fresh context */
export function compileModule( definition:AnyModuleDefinition, env:CompileEnv ) {
  const createBaseCtx:CreateBaseCtx = () => ({
    client: env.bot.client,
    bot: env.bot,
    namespace: env.namespace,
    guild: env.guild,
    settings: env.settings,
    storage: env.getStorage,
  })

  const { scope, slashCommands } = compileCommands( definition.commands, createBaseCtx, env, [] )

  return new DCModule({
    prefix: env.prefix,
    commands: scope,
    filters: compileFilters( definition.filters, createBaseCtx, env ),
    slashCommands,
    interactions: compileComponents( definition.components, createBaseCtx, env ),
    events: compileEvents( definition.events, createBaseCtx, env ),
    endpoints: compileEndpoints( definition.endpoints, createBaseCtx, env ),
    setups: definition.setup ? [ () => definition.setup!( createBaseCtx() ) ] : [],
    translation: definition.translation,
  })
}

/** `groupPath`: names of the groups the tree is in; empty at the root, where commands can be slash commands too */
function compileCommands( tree:CommandsTree, createBaseCtx:CreateBaseCtx, env:CompileEnv, groupPath:string[], groupDescription?:string ) {
  const scopeConfig:ScopeConfig = {}
  const slashCommands:Record<string, DCCmdExecutor> = {}

  for (const [ name, item ] of Object.entries( tree )) {
    if (item.kind === `group`) {
      const nested = compileCommands( item.commands, createBaseCtx, env, [ ...groupPath, name ], item.description )

      scopeConfig[ name ] = new DCScope( { sd:item.description, perms:item.perms }, nested.scope.config )
      Object.assign( slashCommands, nested.slashCommands )
      continue
    }

    if (item.message) scopeConfig[ name ] = createTextExecutor( item, createBaseCtx, env, [ ...groupPath, name ] )
    if (!item.slash) continue

    // A slash command is `/name`, or `/group name` for a command in a root group; Discord has no deeper levels for them
    if (groupPath.length > 1) {
      env.bot.logSystem( `[fgYellow]Module "${env.moduleName}"[]: "${[ ...groupPath, name ].join( ` ` )}" is too deep in groups to be a slash command` )
      continue
    }

    const slashName = [ ...groupPath, name ].map( toSlashCommandName ).join( ` ` )
    slashCommands[ slashName ] = createSlashExecutor( item, createBaseCtx, env, slashName, groupDescription )
  }

  return { scope:new DCScope( {}, scopeConfig ), slashCommands }
}

function createTextExecutor( command:AnyCommand, createBaseCtx:CreateBaseCtx, env:CompileEnv, commandPath:string[] ) {
  const meta = { sd:command.description, perms:command.perms, params:mapParams( command.params, toExecutorParam ) }

  return new DefinedTextExecutor( meta, command.params, ($:ModuleCtx, params:Record<string, unknown>) => {
    logCall( env, `Command`, commandPath.join( ` ` ) + describeParams( params ), $.msg ?? $.interaction ?? null )
    return command.run( createCommandCtx( $, createBaseCtx() ), params )
  } )
}

function createCommandCtx( $:ModuleCtx, base:BaseCtx<ParamsShape> ): CommandCtx<ParamsShape> {
  if ($.msg) return { ...base, source:`message`, message:$.msg, channel:$.msg.channel, member:$.msg.member, send:$.send, runCommand:$.runCmd }
  if ($.interaction) return { ...base, source:`slash`, interaction:$.interaction, channel:$.interaction.channel, member:$.member, send:$.send, runCommand:$.runCmd }

  throw new Error( `A command ran without a message or an interaction` )
}

/** `slashName`: `name`, or `group name` for a subcommand, whose group's description describes the whole command */
function createSlashExecutor( command:AnyCommand, createBaseCtx:CreateBaseCtx, env:CompileEnv, slashName:string, groupDescription?:string ) {
  const names = Object.keys( command.params )
  const meta = { sd:command.description, params:mapParams( command.params, toSlashParam ), groupDescription }

  return new DCCmdExecutor( meta, async(cmdCtx, ...values:unknown[]) => {
    const params = parseValues( command.params, name => normalizeOptionValue( command.params[ name ], values[ names.indexOf( name ) ] ) )

    if (params instanceof ExecutionError) {
      const response = describeResponse( params, env.namespace.getCompoundModule().translation, env.prefix )
      return cmdCtx.send( response?.type === `error` ? `**${response.title}** :: ${response.description}` : `Error` )
    }

    const { cmd:interaction } = cmdCtx

    logCall( env, `Slash`, `/${slashName}${describeParams( params )}`, interaction )

    return command.run( {
      ...createBaseCtx(),
      source: `slash`,
      interaction,
      channel: interaction.channel,
      member: toGuildMember( interaction.member ),
      send: cmdCtx.send,
      runCommand: cmdCtx.runCmd,
    }, params )
  } )
}

/** Discord's slash command names are lowercase: `fromSlash` becomes `from-slash` */
function toSlashCommandName( name:string ) {
  return name.replace( /([a-z0-9])([A-Z])/g, `$1-$2` ).toLowerCase()
}

/** Discord registers mentions, numbers and booleans as typed options; every other kind is a text option */
function toSlashParam( name:string, param:Param ): ExecutorParam {
  const type = param.kind === `number` || param.kind === `bool` || param.kind === `mention` ? param.kind : `message`
  return { ...toExecutorParam( name, param ), type, desc:param.description ?? name }
}

/** A text option may hold `<#id>`-like mentions, parsed like in a text command */
function normalizeOptionValue( param:undefined | Param, value:unknown ) {
  if (!param || typeof value !== `string` || param.kind === `string` || param.kind === `rest`) return value
  return param.parseText( value ) ?? value
}

function compileFilters( filters:FiltersList, createBaseCtx:CreateBaseCtx, env:CompileEnv ) {
  const compiled = filters.map( item => Array.isArray( item ) ? item.map( filter => compileFilter( filter, createBaseCtx, env ) ) : compileFilter( item, createBaseCtx, env ) )

  // Groups (arrays) are supported by the processor, but `DCModuleConfig.filters` types only single filters
  return compiled as DCFilter[]
}

function compileFilter( filter:FilterDefinition<ParamsShape>, createBaseCtx:CreateBaseCtx, env:CompileEnv ) {
  const { match } = filter

  // The processor tests the text first; a RegExp with the `g` flag remembers where it stopped, so it starts over for every message
  const testText = match instanceof RegExp ? (text:string) => {
    match.lastIndex = 0
    return match.test( text )
  } : () => true

  const filterName = match instanceof RegExp ? String( match ) : match.name || `(function)`

  return new DCFilter( testText, async(text, $, filterCtx) => {
    if (!$.msg) return

    // Only `continueGroup` lets the group go on, not a previous filter's "not matched" below
    filterCtx.continueFilteringGroup = false

    const ctx = {
      ...createBaseCtx(),
      message: $.msg,
      channel: $.msg.channel,
      member: $.msg.member,
      send: $.send,
      runCommand: $.runCmd,
      stopFiltering: () => {
        filterCtx.breakFiltering = true
      },
      continueGroup: () => {
        filterCtx.continueFilteringGroup = true
      },
    }

    await runSafely( env, `the filter ${filterName}`, async() => {
      const result = match instanceof RegExp ? text.match( match ) : match( ctx )

      // Not matched: no call, no log line, and the next filter of the group gets its turn (like after a RegExp that doesn't match)
      if (!result) {
        filterCtx.continueFilteringGroup = true
        return
      }

      logCall( env, `Filter`, filterName, $.msg )
      await filter.run({ ...ctx, match:result === true ? null : result })
    } )
  } )
}

function compileComponents( components:ModuleDefinition<ParamsShape>[ `components` ], createBaseCtx:CreateBaseCtx, env:CompileEnv ) {
  const compiled:Record<string, DCInteractionHandler> = {}

  for (const [ key, handler ] of Object.entries( components )) {
    const regex = key.length > 1 && key.startsWith( `/` ) && key.endsWith( `/` ) ? new RegExp( key.slice( 1, -1 ) ) : null

    compiled[ key ] = interaction => {
      if (!interaction.isMessageComponent() && !interaction.isModalSubmit()) return

      logCall( env, `Component`, interaction.customId, interaction )
      runSafely( env, `the component ${interaction.customId}`, () => handler({ ...createBaseCtx(), interaction, match:regex ? interaction.customId.match( regex ) : null }) )
    }
  }

  return compiled
}

function compileEvents( events:ModuleDefinition<ParamsShape>[ `events` ], createBaseCtx:CreateBaseCtx, env:CompileEnv ) {
  const compiled:DCEventListener[] = []

  for (const [ name, handler ] of Object.entries( events )) {
    if (!handler) continue

    compiled.push({
      name,
      listener: (...args) => {
        if (!concernsGuild( args, env.guild.id )) return

        logCall( env, `Event`, name, { user:findEventUser( args ) } )
        runSafely( env, `the event ${name}`, () => (handler as ( ...handlerArgs:unknown[]) => unknown)( ...args, createBaseCtx() ) )
      },
    })
  }

  return compiled
}

/** Served under the namespace's and the module's prefix, so nothing clashes; errors aren't caught here: the HTTP server logs them and answers 500 */
function compileEndpoints( endpoints:ModuleDefinition<ParamsShape>[ `endpoints` ], createBaseCtx:CreateBaseCtx, env:CompileEnv ) {
  const compiled = new Map<string, DCEndpoint>()

  for (const [ key, handler ] of Object.entries( endpoints )) {
    const endpoint = toServerEndpoint( key, env.namespace.id, env.moduleName )

    if (!endpoint) {
      env.bot.logSystem( `[fgYellow]Module "${env.moduleName}"[]: the endpoint "${key}" isn't "METHOD /path"` )
      continue
    }

    if (compiled.has( endpoint )) {
      env.bot.logSystem( `[fgYellow]Module "${env.moduleName}"[]: the endpoint "${key}" repeats ${endpoint}` )
      continue
    }

    compiled.set( endpoint, {
      endpoint,
      handler: async(request:HttpRequest) => {
        const startedAt = performance.now()

        try {
          const answer = await handler({ ...createBaseCtx(), request })
          logEndpointCall( env, request, typeof answer === `number` ? answer : answer.status, startedAt )

          return answer
        } catch (error) {
          logEndpointCall( env, request, 500, startedAt )
          throw error
        }
      },
    } )
  }

  return [ ...compiled.values() ]
}

/** `post /events/` of the module `minecraft` in the namespace `123` → `POST /api/123/minecraft/events` */
function toServerEndpoint( key:string, namespaceId:string, moduleName:string ) {
  const match = key.trim().match( ENDPOINT_KEY )
  if (!match) return null

  const [ , method = ``, path = `` ] = match

  return `${method.toUpperCase()} ${[ `/api`, namespaceId, moduleName, path.replace( /\/+/g, `/` ) ].filter( Boolean ).join( `/` )}`
}

/** In the columns of the message log: the module instead of the channel, the method instead of the user, then the path, the status and the handler's time */
function logEndpointCall( env:CompileEnv, request:HttpRequest, status:number, startedAt:number ) {
  const duration = Math.round( performance.now() - startedAt )
  env.bot.logServer( env.guild.name, env.moduleName, request.method, `Endpoint`, `${request.path} → ${status} (${duration} ms)` )
}

/** The user an event is about (e.g. the member who joined), if any argument is one */
function findEventUser( args:unknown[] ) {
  for (const arg of args) {
    if (arg instanceof User) return arg
    if (arg instanceof GuildMember) return arg.user
  }

  return null
}

/**
 * One console line per handler call, in the format of the message log: guild, channel, user, the kind of call, then
 * `module › what` (the command with its parameters, the filter's pattern, the event, the component's customId)
 */
function logCall( env:CompileEnv, kind:CallKind, details:string, source:null | CallSource ) {
  const channel = source?.channel
  const channelName = channel && `name` in channel && channel.name ? channel.name : `-`
  const user = source && `author` in source ? source.author : source?.user

  env.bot.logServer( env.guild.name, channelName, user?.username ?? `-`, kind, `${env.moduleName} › ${details}` )
}

/** A module's error is logged, never thrown further: it would stop the whole bot as an unhandled rejection */
async function runSafely( env:CompileEnv, what:string, fn:() => unknown ) {
  try {
    await fn()
  } catch (error) {
    env.bot.logSystem( `[fgRed]Module "${env.moduleName}"[]: ${what} failed\n${error instanceof Error ? error.stack ?? error.message : error}` )
  }
}

/** ` {"from":1,"to":10}` for the given parameters, nothing without any */
function describeParams( params:Record<string, unknown> ) {
  const givenParams = Object.entries( params ).filter( ([ , value ]) => value !== undefined )
  if (!givenParams.length) return ``

  return ` ${JSON.stringify( Object.fromEntries( givenParams ) )}`
}

/** An event concerns a guild when an argument belongs to it; events without any guild (e.g. `clientReady`) concern every guild */
function concernsGuild( args:unknown[], guildId:string ) {
  for (const arg of args) {
    const argGuildId = findGuildId( arg )
    if (argGuildId) return argGuildId === guildId
  }

  return true
}

function findGuildId( value:unknown ) {
  if (value instanceof Guild) return value.id
  if (typeof value !== `object` || value === null) return null

  const { guild, guildId } = value as { guild?: unknown, guildId?: unknown }
  if (guild instanceof Guild) return guild.id

  return typeof guildId === `string` ? guildId : null
}

function toGuildMember( member:null | GuildMember | APIInteractionGuildMember ) {
  return member instanceof GuildMember ? member : null
}

function mapParams( params:ParamsShape, mapParam:(name:string, param:Param) => ExecutorParam ) {
  return Object.entries( params ).map( ([ name, param ]) => mapParam( name, param ) )
}
