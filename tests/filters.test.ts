import { describe, expect, mock, test } from "bun:test"
import { handleMessage } from "../src/discord/handlers/messages.js"
import DCModule, { DCFilter } from "../src/discord/DiscordModule.js"
import { Executor, Filter, Module, Namespace, Scope } from "../src/core/index.js"
import { createFakeBot, createFakeMessage, createNamespace, flushAsyncWork } from "./fakes.js"
import type { FilterContext } from "../src/core/index.js"

type FilterGroup = Filter | Filter[]

/** Runs a message through filters of a communicator-agnostic namespace (no Discord involved) */
async function runFilters( filters:FilterGroup[], message:string, ctx:unknown = {} ) {
  const namespace = new Namespace( `namespace`, `Test` )

  // A group (array) of filters is supported by the processor, but `ModuleConfig.filters` types only single filters
  namespace.loadModule( new Module({ filters:filters as Filter[] }) )
  namespace.processMessage({ message, executorDataGetter:() => ctx })

  await flushAsyncWork()
}

describe( `Filter (core, no communicator)`, () => {
  test( `a RegExp filter runs only for matching messages`, async() => {
    const onMatch = mock()
    const filters = [ new Filter( /hello/i, onMatch ) ]

    await runFilters( filters, `Hello there` )
    await runFilters( filters, `Good bye` )

    expect( onMatch ).toHaveBeenCalledTimes( 1 )
    expect( onMatch.mock.calls[ 0 ]?.[ 0 ] ).toBe( `Hello there` )
  } )

  test( `a function filter decides with its own logic`, async() => {
    const onLongMessage = mock()
    const filters = [ new Filter( message => message.length > 10, onLongMessage ) ]

    await runFilters( filters, `short` )
    await runFilters( filters, `a much longer message` )

    expect( onLongMessage ).toHaveBeenCalledTimes( 1 )
  } )

  test( `a filter gets the context of the communicator`, async() => {
    const onMatch = mock()

    await runFilters( [ new Filter( /./, onMatch ) ], `text`, { source:`test context` } )

    expect( onMatch.mock.calls[ 0 ]?.[ 1 ] ).toEqual({ source:`test context` })
  } )

  test( `in a group, only the first matching filter runs`, async() => {
    const first = mock()
    const second = mock()

    await runFilters( [ [ new Filter( /bad/, first ), new Filter( /bad/, second ) ] ], `bad word` )

    expect( first ).toHaveBeenCalledTimes( 1 )
    expect( second ).not.toHaveBeenCalled()
  } )

  test( `continueFilteringGroup lets the next filter of the group run`, async() => {
    const second = mock()
    const first = (_text:string, _ctx:unknown, filterCtx:FilterContext) => {
      filterCtx.continueFilteringGroup = true
    }

    await runFilters( [ [ new Filter( /bad/, first ), new Filter( /bad/, second ) ] ], `bad word` )

    expect( second ).toHaveBeenCalledTimes( 1 )
  } )

  test( `separate groups all run, until a filter sets breakFiltering`, async() => {
    const laterGroup = mock()
    const breakingFilter = (_text:string, _ctx:unknown, filterCtx:FilterContext) => {
      filterCtx.breakFiltering = true
    }

    await runFilters( [ new Filter( /a/, mock() ), new Filter( /a/, laterGroup ) ], `a` )
    await runFilters( [ new Filter( /a/, breakingFilter ), new Filter( /a/, laterGroup ) ], `a` )

    expect( laterGroup ).toHaveBeenCalledTimes( 1 )
  } )

  test( `filters run for command messages too, next to the command`, async() => {
    const onFilter = mock()
    const onCommand = mock()
    const namespace = new Namespace( `namespace`, `Test` )

    namespace.loadModule( new Module({
      prefix: `cc! `,
      filters: [ new Filter( /ping/, onFilter ) ],
      commands: new Scope( {}, { ping:new Executor( {}, onCommand ) } ),
    }) )

    namespace.processMessage({ message:`cc! ping`, executorDataGetter:() => ({}), checkPermissions:() => true })
    await flushAsyncWork()

    expect( onFilter ).toHaveBeenCalledTimes( 1 )
    expect( onCommand ).toHaveBeenCalledTimes( 1 )
  } )
} )

describe( `DCFilter (through the Discord message handler)`, () => {
  test( `a filter replies in the channel of the message`, async() => {
    const namespace = createNamespace( new DCModule({
      filters: [ new DCFilter( /\bcactus\b/i, (_text, $) => $.send( `🌵` ) ) ],
    }) )
    const message = createFakeMessage( `I like my cactus` )

    handleMessage( createFakeBot( namespace ), message )
    await flushAsyncWork()

    expect( message.channel.send ).toHaveBeenCalledWith( `🌵` )
  } )

  test( `the bot's own messages are not filtered`, async() => {
    const onMatch = mock()
    const namespace = createNamespace( new DCModule({ filters:[ new DCFilter( /./, onMatch ) ] }) )

    handleMessage( createFakeBot( namespace ), createFakeMessage( `echo`, { authorId:`bot-id`, isBot:true } ) )
    await flushAsyncWork()

    expect( onMatch ).not.toHaveBeenCalled()
  } )
} )
