import path from "path"
import os from "os"
import fs from "fs/promises"
import { describe, expect, mock, test } from "bun:test"
import { command, createModuleKit, defineModule, filter, group, isModuleDefinition } from "../src/discord/modules/define.js"
import { compileModule } from "../src/discord/modules/compile.js"
import { handleSlashCommand, registerGuildSlashCommands } from "../src/discord/handlers/slashCommands.js"
import { handleMessage } from "../src/discord/handlers/messages.js"
import { bool, ModuleRegistry, Namespace, number, parseTextParams, parseValues, resolveNamespaceFolder, rest, string } from "../src/core/index.js"
import { createFakeBot, createFakeInteraction, createFakeMessage, flushAsyncWork, getSentText, GUILD } from "./fakes.js"
import type { Guild, SlashCommandBuilder } from "discord.js"
import type { AnyModuleDefinition } from "../src/discord/modules/define.js"
import type DCModule from "../src/discord/DiscordModule.js"

/** Compiles a module definition into a namespace of a fake bot, like `DiscordModules` does for a guild */
function setUpModule( definition:AnyModuleDefinition, settings:Record<string, unknown> = {} ) {
  const namespace = new Namespace<DCModule>( GUILD.id, GUILD.name )
  const bot = createFakeBot( namespace )
  const storage = mock( async() => ({}) )

  const compiled = compileModule( definition, {
    bot,
    namespace,
    guild: GUILD as Guild,
    moduleName: `test`,
    prefix: `cc! `,
    settings,
    getStorage: storage as never,
  } )

  namespace.loadModule( compiled )

  return { bot, namespace, compiled }
}

async function sendMessage( bot:ReturnType<typeof createFakeBot>, content:string, messageConfig?:Parameters<typeof createFakeMessage>[ 1 ] ) {
  const message = createFakeMessage( content, messageConfig )

  handleMessage( bot, message )
  await flushAsyncWork()

  return message
}

describe( `typed parameters`, () => {
  const shape = { count:number(), loud:bool().default( false ), text:rest().optional() }

  test( `text parameters are parsed into their types, by name`, () => {
    expect( parseTextParams( shape, `3 yes hello  there` ) ).toEqual({ count:3, loud:true, text:`hello  there` })
    expect( parseTextParams( shape, `3 hello` ) ).toEqual({ count:3, loud:false, text:`hello` })
  } )

  test( `wrong, missing and extra words are errors`, () => {
    expect( parseTextParams( shape, `three` ).constructor.name ).toBe( `WrongExecutionParameter` )
    expect( parseTextParams( shape, `` ).constructor.name ).toBe( `MissingExecutionParameter` )
    expect( parseTextParams( { count:number() }, `1 2` ).constructor.name ).toBe( `OverlimitedExecutorParameter` )
  } )

  test( `ready values (settings, slash options) are checked and get their defaults`, () => {
    const settings = { channelId:string(), enabled:bool().default( true ) }

    expect( parseValues( settings, name => ({ channelId:`123` })[ name ] ) ).toEqual({ channelId:`123`, enabled:true })
    expect( parseValues( settings, () => undefined ).constructor.name ).toBe( `MissingExecutionParameter` )
    expect( parseValues( settings, name => ({ channelId:5 })[ name ] ).constructor.name ).toBe( `WrongExecutionParameter` )
  } )
} )

describe( `module definitions on Discord`, () => {
  const add = mock()
  const definition = defineModule({
    commands: {
      add: command({ slash:true, description:`Adds`, params:{ a:number(), b:number().default( 10 ) }, run:(ctx, params) => add( ctx.source, params ) }),
      ping: command({ run:ctx => ctx.send( `pong` ) }),
      fromSlash: command({ slash:true, description:`Runs ping`, run:ctx => ctx.runCommand( `ping` ) }),
      $: group({ perms:`_ADMIN`, commands:{ secret:command({ run:ctx => ctx.send( `secret` ) }) } }),
    },
    filters: [ filter( /\bcactus (\w+)/, ctx => ctx.send( `cactus says ${ctx.match?.[ 1 ]}` ) ) ],
  })

  test( `a text command gets typed, named parameters`, async() => {
    add.mockClear()
    const { bot } = setUpModule( definition )

    await sendMessage( bot, `cc! add 2` )

    expect( add ).toHaveBeenCalledWith( `message`, { a:2, b:10 } )
  } )

  test( `a command's help shows each parameter with its kind, default value and description`, async() => {
    const { bot } = setUpModule( defineModule({
      commands: {
        say: command({
          description: `Says something`,
          params: { times:number().default( 1 ).describe( `How many times` ), text:rest().describe( `What to say\nCan be long` ) },
          run: () => undefined,
        }),
      },
    }) )

    const text = getSentText( await sendMessage( bot, `cc! say ?` ) )

    expect( text ).toContain( `\`cc! say [times] <text…>\`\nSays something` )
    expect( text ).toContain( [
      `**Parameters**`,
      `\`times\` · **optional** · default \`1\``,
      `-# How many times`,
      `\`text\` · **required, rest of the message**`,
      `-# What to say`,
      `-# Can be long`,
    ].join( `\n` ) )
  } )

  test( `the legend (parameter notation, the "?" tip) is only on the main help page`, async() => {
    const { bot } = setUpModule( defineModule({
      commands: { fun:group({ commands:{ say:command({ params:{ text:rest() }, run:() => undefined }) } }) },
    }) )
    const legendLine = `\`<parameter>\` is required`

    expect( getSentText( await sendMessage( bot, `cc!` ) ) ).toContain( legendLine )
    expect( getSentText( await sendMessage( bot, `cc! fun` ) ) ).not.toContain( legendLine )
    expect( getSentText( await sendMessage( bot, `cc! fun say ?` ) ) ).not.toContain( legendLine )
  } )

  test( `a wrong parameter still ends with the error embed`, async() => {
    const { bot } = setUpModule( definition )
    const message = await sendMessage( bot, `cc! add two` )

    expect( getSentText( message ) ).toContain( `Bad parameter` )
  } )

  test( `a group's permissions guard its commands`, async() => {
    const { bot } = setUpModule( definition )

    expect( (await sendMessage( bot, `cc! $ secret`, { member:{ isAdmin:true } } )).channel.send ).toHaveBeenCalledWith( `secret` )
    expect( (await sendMessage( bot, `cc! $ secret` )).channel.send ).not.toHaveBeenCalledWith( `secret` )
  } )

  test( `a filter gets the RegExp match`, async() => {
    const { bot } = setUpModule( definition )

    expect( (await sendMessage( bot, `my cactus grows` )).channel.send ).toHaveBeenCalledWith( `cactus says grows` )
  } )

  test( `slash: commands are registered with their params as options, names in kebab-case`, () => {
    const { bot, namespace } = setUpModule( definition )

    registerGuildSlashCommands( bot, GUILD as Guild, namespace )

    const [ , { body } ] = bot.rest.put.mock.calls[ 0 ] as unknown as [ string, { body: SlashCommandBuilder[] } ]
    const registered = body.map( cmd => cmd.toJSON() )

    expect( registered.map( cmd => cmd.name ) ).toEqual([ `add`, `from-slash` ])
    expect( registered[ 0 ]?.options?.map( option => [ option.name, option.type, option.required ] ) ).toEqual([ [ `a`, 10, true ], [ `b`, 10, false ] ])
  } )

  test( `slash: the same command gets the same typed parameters`, async() => {
    add.mockClear()
    const { bot } = setUpModule( definition )

    handleSlashCommand( bot, createFakeInteraction( `add`, { options:[ { name:`a`, value:5 } ] } ) )
    await flushAsyncWork()

    expect( add ).toHaveBeenCalledWith( `slash`, { a:5, b:10 } )
  } )

  test( `every call of a command, filter or slash command gets a console line`, async() => {
    const { bot } = setUpModule( definition )

    await sendMessage( bot, `cc! add 2` )
    await sendMessage( bot, `my cactus grows` )
    handleSlashCommand( bot, createFakeInteraction( `add`, { options:[ { name:`a`, value:5 } ] } ) )
    await flushAsyncWork()

    // Every incoming message has its own `Message` line already, before the lines of what it triggered
    const logs = bot.logServer.mock.calls
      .filter( ([ , , , kind ]) => kind !== `Message` )
      .map( ([ guild, channel, user, kind, details ]) => `${guild} | ${channel} | ${user} | ${kind} | ${details}` )

    expect( logs ).toEqual([
      `Test guild | general | tester | Command | test › add {"a":2,"b":10}`,
      `Test guild | general | tester | Filter | test › /\\bcactus (\\w+)/`,
      `Test guild | - | tester | Slash | test › /add {"a":5,"b":10}`,
    ])
  } )

  test( `slash: a root group's slash commands become its subcommands (/group name)`, async() => {
    const run = mock()
    const { bot, namespace } = setUpModule( defineModule({
      commands: {
        site: group({ description:`The site`, commands:{ login:command({ slash:true, message:false, description:`Log in`, params:{ code:number().optional() }, run:(_ctx, params) => run( params ) }) } }),
      },
    }) )

    registerGuildSlashCommands( bot, GUILD as Guild, namespace )

    const [ , { body } ] = bot.rest.put.mock.calls[ 0 ] as unknown as [ string, { body: SlashCommandBuilder[] } ]
    const [ site ] = body.map( cmd => cmd.toJSON() )

    expect( site ).toMatchObject({ name:`site`, description:`The site`, options:[ { name:`login`, type:1, description:`Log in`, options:[ { name:`code`, type:10 } ] } ] })

    handleSlashCommand( bot, createFakeInteraction( `site`, { subcommand:`login`, options:[ { name:`code`, value:42 } ] } ) )
    await flushAsyncWork()

    expect( run ).toHaveBeenCalledWith({ code:42 })
  } )

  test( `slash: a command that throws is logged, and the user gets an error instead of an endless "is thinking…"`, async() => {
    const { bot } = setUpModule( defineModule({
      commands: {
        broken: command({ slash: true, message: false, description: `Breaks`, run: async ctx => {
          if (ctx.source === `slash`) await ctx.interaction.deferReply()
          throw new Error( `button bug` )
        } }),
      },
    }) )
    const interaction = createFakeInteraction( `broken` )

    await handleSlashCommand( bot, interaction )

    expect( String( bot.logSystem.mock.calls[ 0 ]?.[ 0 ] ) ).toStartWith( `[fgRed]The slash command /broken failed[]\nError: button bug` )
    expect( interaction.editReply ).toHaveBeenCalledWith({ content:`**Error** · This command has invalid code` })
  } )

  test( `slash: runCommand runs a text command, which replies to the interaction`, async() => {
    const { bot } = setUpModule( definition )
    const interaction = createFakeInteraction( `from-slash` )

    handleSlashCommand( bot, interaction )
    await flushAsyncWork()

    expect( interaction.reply ).toHaveBeenCalledWith({ content:`pong` })
  } )
} )

describe( `filters with logic`, () => {
  const isGeneralChannel = (ctx:{ channel: object }) => `name` in ctx.channel && ctx.channel.name === `general`

  test( `a matcher gets the whole context; the filter runs and logs only when it matches`, async() => {
    const run = mock()
    const { bot } = setUpModule( defineModule({
      filters: [ filter( function isLongInGeneral( ctx ) {
        return isGeneralChannel( ctx ) && ctx.message.content.length > 10
      }, run ) ],
    }) )

    await sendMessage( bot, `short` )
    await sendMessage( bot, `a much longer message` )

    const filterLogs = bot.logServer.mock.calls.filter( ([ , , , kind ]) => kind === `Filter` )

    expect( run ).toHaveBeenCalledTimes( 1 )
    expect( filterLogs.map( ([ , , , , details ]) => details ) ).toEqual([ `test › isLongInGeneral` ])
  } )

  test( `a matcher can hand its RegExp match over to the filter`, async() => {
    const run = mock()
    const { bot } = setUpModule( defineModule({ filters:[ filter( ctx => ctx.message.content.match( /#(\w+)/ ), ctx => run( ctx.match?.[ 1 ] ) ) ] }) )

    await sendMessage( bot, `look #cactus` )

    expect( run ).toHaveBeenCalledWith( `cactus` )
  } )

  test( `in a group, a matcher that doesn't match lets the next filter run`, async() => {
    const first = mock()
    const second = mock()
    const { bot } = setUpModule( defineModule({ filters:[ [ filter( () => false, first ), filter( /./, second ) ] ] }) )

    await sendMessage( bot, `anything` )

    expect( first ).not.toHaveBeenCalled()
    expect( second ).toHaveBeenCalledTimes( 1 )
  } )

  test( `a RegExp with the "g" flag matches every message, not every other one`, async() => {
    const run = mock()
    const { bot } = setUpModule( defineModule({ filters:[ filter( /cactus/gi, run ) ] }) )

    await sendMessage( bot, `cactus one` )
    await sendMessage( bot, `cactus two` )
    await sendMessage( bot, `cactus three` )

    expect( run ).toHaveBeenCalledTimes( 3 )
  } )
} )

describe( `errors in modules never stop the bot`, () => {
  test( `a failing matcher or filter is logged, and the other filters still run`, async() => {
    const afterwards = mock()
    const { bot } = setUpModule( defineModule({
      filters: [
        filter( function brokenMatcher() {
          throw new Error( `matcher bug` )
        }, mock() ),
        filter( /./, () => {
          throw new Error( `filter bug` )
        } ),
        filter( /./, afterwards ),
      ],
    }) )

    await sendMessage( bot, `anything` )

    const errors = bot.logSystem.mock.calls.map( ([ text ]) => String( text ).split( `\n` )[ 0 ] )

    expect( errors ).toEqual([ `[fgRed]Module "test"[]: the filter brokenMatcher failed`, `[fgRed]Module "test"[]: the filter /./ failed` ])
    expect( afterwards ).toHaveBeenCalledTimes( 1 )
  } )

  test( `a failing event handler is logged`, async() => {
    const { compiled, bot } = setUpModule( defineModule({
      events: { guildMemberAdd:() => Promise.reject( new Error( `event bug` ) ) },
    }) )

    compiled.events[ 0 ]!.listener({ guildId:GUILD.id })
    await flushAsyncWork()

    expect( String( bot.logSystem.mock.calls[ 0 ]?.[ 0 ] ) ).toStartWith( `[fgRed]Module "test"[]: the event guildMemberAdd failed` )
  } )

  test( `a reply that can't be sent (e.g. missing permissions) doesn't escape`, async() => {
    const { bot } = setUpModule( defineModule({ commands:{ ping:command({ run:ctx => ctx.send( `pong` ) }) } }) )
    const message = createFakeMessage( `cc!` )
    const consoleError = console.error

    message.channel.send.mockImplementation( () => Promise.reject( new Error( `Missing Permissions` ) ) )
    console.error = mock()

    handleMessage( bot, message )
    await flushAsyncWork()

    const logged = (console.error as ReturnType<typeof mock>).mock.calls[ 0 ]?.[ 0 ]
    console.error = consoleError

    expect( logged ).toBe( `Namespace "Test guild": a command failed` )
  } )
} )

describe( `module settings and events`, () => {
  const kit = createModuleKit({ greeting:string() })
  const onJoin = mock()

  const definition = kit.defineModule({
    commands: { greet:kit.command({ run:ctx => ctx.send( ctx.settings.greeting ) }) },
    events: { guildMemberAdd:(member, ctx) => onJoin( member, ctx.settings.greeting ) },
  })

  test( `commands read the namespace's settings`, async() => {
    const { bot } = setUpModule( definition, { greeting:`Cześć!` } )

    expect( (await sendMessage( bot, `cc! greet` )).channel.send ).toHaveBeenCalledWith( `Cześć!` )
  } )

  test( `events reach the module only for its own guild`, () => {
    const { compiled, bot } = setUpModule( definition, { greeting:`hi` } )
    const listener = compiled.events.find( ({ name }) => name === `guildMemberAdd` )!.listener

    listener({ guildId:GUILD.id, id:`member-1` })
    listener({ guildId:`another-guild`, id:`member-2` })

    expect( onJoin.mock.calls.map( ([ member ]) => (member as { id: string }).id ) ).toEqual([ `member-1` ])
    expect( bot.logServer ).toHaveBeenCalledTimes( 1 )
    expect( bot.logServer ).toHaveBeenCalledWith( `Test guild`, `-`, `-`, `Event`, `test › guildMemberAdd` )
  } )

  test( `two modules of one namespace both get the same event`, () => {
    const first = setUpModule( defineModule({ events:{ guildMemberAdd:mock() } }) ).compiled
    const second = setUpModule( defineModule({ events:{ guildMemberAdd:mock() } }) ).compiled

    first.merge( second )

    expect( first.events.map( ({ name }) => name ) ).toEqual([ `guildMemberAdd`, `guildMemberAdd` ])
  } )

  test( `setup gets the context, and its returned cleanup is kept for the next reload`, async() => {
    const cleanup = mock()
    const setup = mock( (ctx:{ settings: { greeting: string } }) => {
      onJoin( ctx.settings.greeting )
      return cleanup
    } )

    const { compiled } = setUpModule( kit.defineModule({ setup }), { greeting:`started` } )
    const result = await compiled.setups[ 0 ]!()

    expect( onJoin ).toHaveBeenLastCalledWith( `started` )
    expect( result ).toBe( cleanup )
  } )
} )

/** A module file whose `err.error` translation shows which version got loaded */
function createModuleCode( text:string ) {
  return `export default { kind:"module", settings:{}, commands:{}, filters:[], components:{}, events:{}, setup:null, translation:{ "err.error":${JSON.stringify( text )} } }\n`
}

describe( `ModuleRegistry`, () => {
  test( `loads the real admin module`, async() => {
    const registry = new ModuleRegistry( `modules`, isModuleDefinition )
    const errors = await registry.loadAll()

    expect( errors ).toEqual([])
    expect( Object.keys( registry.get( `admin` )?.definition.commands ?? {} ) ).toEqual([ `nobody`, `$` ])
  } )

  test( `the real admin module works through the message handler, for administrators only`, async() => {
    const registry = new ModuleRegistry( `modules`, isModuleDefinition )
    await registry.loadAll()

    const { bot } = setUpModule( registry.get( `admin` )!.definition )

    expect( (await sendMessage( bot, `cc! $ eval send( 20 + 22 )`, { member:{ isAdmin:true } } )).channel.send ).toHaveBeenCalledWith( `42` )
    expect( (await sendMessage( bot, `cc! $ eval send( 20 + 22 )` )).channel.send ).not.toHaveBeenCalledWith( `42` )
  } )

  test( `reloading picks up edits of a multi-file module's sub-files`, async() => {
    const folder = await fs.mkdtemp( path.join( os.tmpdir(), `cactu-modules-` ) )
    const moduleFolder = path.join( folder, `demo` )
    const definitionCode = `export default { kind:"module", settings:{}, commands:{}, filters:[], components:{}, events:{}, translation:{ "err.error":(await import( "./text.js" )).text } }\n`

    await fs.mkdir( moduleFolder )
    await fs.writeFile( path.join( moduleFolder, `index.js` ), definitionCode )
    await fs.writeFile( path.join( moduleFolder, `text.js` ), `export const text = "first"\n` )

    const registry = new ModuleRegistry( folder, isModuleDefinition )
    await registry.loadAll()
    const first = registry.get( `demo` )?.definition.translation[ `err.error` ]

    await fs.writeFile( path.join( moduleFolder, `text.js` ), `export const text = "second"\n` )
    await registry.load( `demo` )
    const second = registry.get( `demo` )?.definition.translation[ `err.error` ]

    await fs.rm( folder, { recursive:true } )

    expect([ first, second ]).toEqual([ `first`, `second` ])
  } )

  test( `a module that fails to reload keeps its last working version; "_" entries aren't modules`, async() => {
    const folder = await fs.mkdtemp( path.join( os.tmpdir(), `cactu-modules-` ) )

    await fs.writeFile( path.join( folder, `greeter.js` ), createModuleCode( `working` ) )
    await fs.writeFile( path.join( folder, `_helper.js` ), `export const helper = 1\n` )

    const registry = new ModuleRegistry( folder, isModuleDefinition )
    const firstErrors = await registry.loadAll()

    await fs.writeFile( path.join( folder, `greeter.js` ), `export default {` )
    const reloadError = await registry.load( `greeter` )

    const version = registry.get( `greeter` )?.definition.translation[ `err.error` ]
    await fs.rm( folder, { recursive:true } )

    expect( firstErrors ).toEqual([])
    expect( registry.getNames() ).toEqual([ `greeter` ])
    expect( reloadError?.name ).toBe( `greeter` )
    expect( version ).toBe( `working` )
  } )
} )

describe( `namespace folders`, () => {
  test( `"<id>--<name>" is created, found by the ID alone, and renamed after the namespace's rename`, async() => {
    const root = await fs.mkdtemp( path.join( os.tmpdir(), `cactu-namespaces-` ) )

    const created = await resolveNamespaceFolder( `123`, `Kaktus intranetowy`, root )
    const foundById = await resolveNamespaceFolder( `123`, undefined, root )
    const renamed = await resolveNamespaceFolder( `123`, `Nowa: nazwa?`, root )
    const entries = await fs.readdir( root )

    await fs.rm( root, { recursive:true } )

    expect( path.basename( created ) ).toBe( `123--KaktusIntranetowy` )
    expect( foundById ).toBe( created )
    expect( path.basename( renamed ) ).toBe( `123--NowaNazwa` )
    expect( entries ).toEqual([ `123--NowaNazwa` ])
  } )
} )
