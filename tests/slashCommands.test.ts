import { describe, expect, mock, test } from "bun:test"
import { handleSlashCommand, registerGlobalSlashCommands, registerGuildSlashCommands } from "../src/discord/handlers/slashCommands.js"
import DCModule, { DCCmdExecutor, DCExecutor } from "../src/discord/DiscordModule.js"
import { Scope } from "../src/core/index.js"
import { createFakeBot, createFakeInteraction, createNamespace, flushAsyncWork, GUILD } from "./fakes.js"
import type { Guild, SlashCommandBuilder } from "discord.js"
import type { ModuleCmdCtx } from "../src/discord/DiscordModule.js"

const RANDOM_PARAMS = [
  { name:`Liczba 1`, type:`number` as const, desc:`From` },
  { name:`Liczba 2`, type:`number` as const, desc:`To`, optional:true },
]

/** A module like the default config: `/random` with spaces in parameter names, plus commands for the other cases */
function createSetup() {
  const random = mock( (ctx:ModuleCmdCtx, from:number, to?:number) => ctx.send( `${from}-${to}` ) )
  const twice = mock( async(ctx:ModuleCmdCtx) => {
    await ctx.send( `first` )
    await ctx.send( `second` )
  } )
  const viaText = mock( (ctx:ModuleCmdCtx) => ctx.runCmd( `clean` ) )
  const inPrivate = mock()

  const namespace = createNamespace( new DCModule({
    commands: new Scope( {}, {
      clean: new DCExecutor( {}, async $ => {
        await $.send( `cleaning` )
        await $.deleteMsg()
      } ),
    } ),
    slashCommands: {
      random: new DCCmdExecutor( { sd:`Random number`, params:RANDOM_PARAMS }, random ),
      twice: new DCCmdExecutor( { sd:`Sends two messages` }, twice ),
      "via-text": new DCCmdExecutor( { sd:`Runs a text command` }, viaText ),
      "in-private": new DCCmdExecutor( { sd:`Works in DMs`, forPrivateMessages:true }, inPrivate ),
    },
  }) )

  return { bot:createFakeBot( namespace ), namespace, random, twice, viaText, inPrivate }
}

/** The JSON bodies sent to Discord's API by `rest.put` */
function getRegisteredCommands( bot:ReturnType<typeof createFakeBot>, callIndex:number ) {
  const [ , options ] = bot.rest.put.mock.calls[ callIndex ] as unknown as [ string, { body: SlashCommandBuilder[] } ]
  return options.body.map( cmd => cmd.toJSON() )
}

describe( `slash command registration`, () => {
  test( `guild commands are registered in the guild, with option names Discord accepts`, () => {
    const { bot, namespace } = createSetup()

    registerGuildSlashCommands( bot, GUILD as Guild, namespace )

    const commands = getRegisteredCommands( bot, 0 )
    const random = commands.find( cmd => cmd.name === `random` )

    expect( commands.map( cmd => cmd.name ) ).toEqual([ `random`, `twice`, `via-text` ])
    expect( random?.options?.map( option => [ option.name, option.required ] ) ).toEqual([ [ `liczba_1`, true ], [ `liczba_2`, false ] ])
  } )

  test( `commands for private messages are registered globally`, () => {
    const { bot, namespace } = createSetup()

    registerGuildSlashCommands( bot, GUILD as Guild, namespace )
    registerGlobalSlashCommands( bot )

    expect( getRegisteredCommands( bot, 1 ).map( cmd => cmd.name ) ).toEqual([ `in-private` ])
    expect( bot.globals.commands.get( `in-private` )?.registrationGuildId ).toBe( GUILD.id )
  } )
} )

describe( `slash command execution`, () => {
  test( `parameters with spaces in their names arrive (the fixed bug)`, async() => {
    const { bot, random } = createSetup()
    const interaction = createFakeInteraction( `random`, { options:[ { name:`liczba_1`, value:5 }, { name:`liczba_2`, value:10 } ] } )

    handleSlashCommand( bot, interaction )
    await flushAsyncWork()

    expect( random.mock.calls[ 0 ]?.slice( 1 ) ).toEqual([ 5, 10 ])
    expect( interaction.reply ).toHaveBeenCalledWith({ content:`5-10` })
  } )

  test( `a skipped optional parameter is undefined`, async() => {
    const { bot, random } = createSetup()

    handleSlashCommand( bot, createFakeInteraction( `random`, { options:[ { name:`liczba_1`, value:7 } ] } ) )
    await flushAsyncWork()

    expect( random.mock.calls[ 0 ]?.slice( 1 ) ).toEqual([ 7, undefined ])
  } )

  test( `the first message is a reply, the next ones are follow-ups (the fixed bug)`, async() => {
    const { bot } = createSetup()
    const interaction = createFakeInteraction( `twice` )

    handleSlashCommand( bot, interaction )
    await flushAsyncWork()

    expect( interaction.reply ).toHaveBeenCalledWith({ content:`first` })
    expect( interaction.followUp ).toHaveBeenCalledWith({ content:`second` })
  } )

  test( `runCmd runs a text command, whose deleteMsg removes the reply (the fixed bugs)`, async() => {
    const { bot } = createSetup()
    const interaction = createFakeInteraction( `via-text` )

    handleSlashCommand( bot, interaction )
    await flushAsyncWork()

    expect( interaction.reply ).toHaveBeenCalledWith({ content:`cleaning` })
    expect( interaction.deferReply ).not.toHaveBeenCalled()
    expect( interaction.deleteReply ).toHaveBeenCalledTimes( 1 )
  } )

  test( `in private messages, the command gets the namespace of the guild that registered it (the fixed bug)`, async() => {
    const { bot, namespace, inPrivate } = createSetup()

    registerGuildSlashCommands( bot, GUILD as Guild, namespace )
    handleSlashCommand( bot, createFakeInteraction( `in-private`, { guildId:null } ) )
    await flushAsyncWork()

    expect( inPrivate.mock.calls[ 0 ]?.[ 0 ] ).toMatchObject({ ns:namespace, registrationGuildId:GUILD.id })
  } )

  test( `an unknown command does nothing`, async() => {
    const { bot, random, twice } = createSetup()
    const interaction = createFakeInteraction( `missing` )

    handleSlashCommand( bot, interaction )
    await flushAsyncWork()

    expect( random ).not.toHaveBeenCalled()
    expect( twice ).not.toHaveBeenCalled()
    expect( interaction.reply ).not.toHaveBeenCalled()
  } )
} )
