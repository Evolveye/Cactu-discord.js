/* Minimal stand-ins for the Discord objects the handlers read, so the tests run without logging in */

import { ChannelType, Collection } from "discord.js"
import { mock } from "bun:test"
import { Namespace } from "../src/core/index.js"
import type { ChatInputCommandInteraction, Message } from "discord.js"
import type DCModule from "../src/discord/DiscordModule.js"
import type CactuDiscordBot from "../src/discord/DiscordBot.js"

type FakeMemberConfig = { roles?: string[], isAdmin?: boolean }
type FakeMessageConfig = { authorId?: string, isBot?: boolean, member?: FakeMemberConfig }
type ComponentJson = { content?: string, components?: ComponentJson[] }
type FakeInteractionConfig = { guildId?: null | string, subcommand?: string, options?: { name: string, value: unknown }[] }

export const GUILD = { id:`guild-1`, name:`Test guild`, emojis:{ cache:new Collection<string, { name: string }>() } }

/** Lets the not-awaited filters and commands started by `processMessage` finish */
export function flushAsyncWork() {
  return new Promise( resolve => setTimeout( resolve, 0 ) )
}

/** The text of the last message a fake channel sent as a Components V2 container (the help, errors), sections included */
export function getSentText( message:{ channel: { send: { mock: { calls: unknown[][] } } } } ) {
  const sent = message.channel.send.mock.calls.at( -1 )?.[ 0 ] as undefined | { components?: { toJSON: () => ComponentJson }[] }

  const collectTexts = (component:ComponentJson): string[] => [ component.content ?? ``, ...(component.components ?? []).flatMap( collectTexts ) ]

  return (sent?.components ?? []).flatMap( container => collectTexts( container.toJSON() ) ).filter( Boolean ).join( `\n` )
}

export function createNamespace( module:DCModule ) {
  const namespace = new Namespace<DCModule>( GUILD.id, GUILD.name )
  namespace.loadModule( module )

  return namespace
}

export function createFakeBot( namespace:Namespace<DCModule> ) {
  const bot = {
    ownerId: undefined,
    namespacesData: new Map([ [ namespace.id, namespace ] ]),
    globals: { commands:new Map() },
    client: {
      user: { id:`bot-id` },
      application: { id:`app-id` },
      guilds: { cache:new Collection([ [ GUILD.id, GUILD ] ]) },
    },
    rest: { put:mock( async() => undefined ) },
    logServer: mock(),
    logDM: mock(),
    logSystem: mock(),
    getWebHook: async() => null,
  }

  return bot as typeof bot & CactuDiscordBot
}

export function createFakeMessage( content:string, { authorId = `user-id`, isBot = false, member = {} }:FakeMessageConfig = {} ) {
  const roles = (member.roles ?? []).map( role => [ role, { id:`${role}-id`, name:role } ] as const )
  const message = {
    content,
    guild: GUILD,
    author: { id:authorId, bot:isBot, username:`tester`, displayAvatarURL:() => `https://cdn.discordapp.com/embed/avatars/0.png` },
    member: {
      displayName: `Tester`,
      roles: { cache:new Collection( roles ) },
      permissions: { has:() => !!member.isAdmin },
    },
    channel: {
      type: ChannelType.GuildText,
      name: `general`,
      isSendable: () => true,
      send: mock( async(sent:unknown) => sent ),
    },
    delete: mock( async() => undefined ),
  }

  return message as typeof message & Message
}

export function createFakeInteraction( commandName:string, { guildId = GUILD.id, subcommand, options = [] }:FakeInteractionConfig = {} ) {
  const interaction = {
    commandName,
    guildId,
    guild: guildId ? GUILD : null,
    member: null,
    user: { id:`user-id`, username:`tester`, displayAvatarURL:() => `https://cdn.discordapp.com/embed/avatars/0.png` },
    channel: { isSendable:() => true, send:mock( async(sent:unknown) => sent ) },
    // Like Discord: a subcommand's options are nested inside it
    options: {
      data: subcommand ? [ { name:subcommand, options } ] : options,
      getSubcommand: () => subcommand ?? null,
    },
    replied: false,
    deferred: false,
    reply: mock( async(sent:unknown) => {
      interaction.replied = true
      return sent
    } ),
    followUp: mock( async(sent:unknown) => sent ),
    editReply: mock( async(sent:unknown) => sent ),
    deferReply: mock( async() => {
      interaction.deferred = true
    } ),
    deleteReply: mock( async() => undefined ),
  }

  return interaction as typeof interaction & ChatInputCommandInteraction
}
