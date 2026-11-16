import { describe, expect, mock, test } from "bun:test"
import { handleMessage } from "../src/discord/handlers/messages.js"
import DCModule, { DCExecutor } from "../src/discord/DiscordModule.js"
import { describeResponse, Executor, Module, Namespace, Scope } from "../src/core/index.js"
import { createFakeBot, createFakeMessage, createNamespace, flushAsyncWork, getSentText } from "./fakes.js"
import type { ProcessorResponse, ProcessorResponseHandlerParam } from "../src/core/index.js"

const PREFIX = `cc! `

/** Sends a message to a communicator-agnostic namespace (no Discord involved), returning the described responses */
async function sendToCore( commands:Scope, message:string, { allowed = true } = {} ) {
  const namespace = new Namespace( `namespace`, `Test` )
  const responses:ProcessorResponseHandlerParam[] = []

  namespace.loadModule( new Module({ prefix:PREFIX, commands }) )
  namespace.processMessage({
    message,
    executorDataGetter: () => ({}),
    checkPermissions: () => allowed,
    handleResponse: response => responses.push( response ),
  })

  await flushAsyncWork()

  return responses
    .map( response => describeResponse( response, {}, PREFIX ) )
    .filter( (response): response is ProcessorResponse => !!response )
}


describe( `prefix commands (core, no communicator)`, () => {
  test( `a message without the prefix is not a command`, async() => {
    const ping = mock()

    await sendToCore( new Scope( {}, { ping:new Executor( {}, ping ) } ), `ping` )

    expect( ping ).not.toHaveBeenCalled()
  } )

  test( `a command gets the context and its parameters (as text)`, async() => {
    const add = mock()
    const commands = new Scope( {}, {
      add: new Executor( { params:[ { name:`a`, type:`number` }, { name:`b`, type:`number` } ] }, add ),
    } )

    await sendToCore( commands, `cc! add 2 40` )

    expect( add ).toHaveBeenCalledWith( {}, `2`, `40` )
  } )

  test( `an optional parameter can be skipped, a "message" parameter takes the rest of the text`, async() => {
    const say = mock()
    const commands = new Scope( {}, {
      say: new Executor( { params:[ { name:`loud`, type:`bool`, optional:true }, { name:`text`, type:`message` } ] }, say ),
    } )

    await sendToCore( commands, `cc! say hello there, world` )
    await sendToCore( commands, `cc! say yes hello` )

    expect( say.mock.calls ).toEqual([ [ {}, undefined, `hello there, world` ], [ {}, `yes`, `hello` ] ])
  } )

  test( `scopes nest commands`, async() => {
    const ban = mock()
    const commands = new Scope( {}, {
      admin: new Scope( {}, { ban:new Executor( { params:[ { name:`user`, type:`string` } ] }, ban ) } ),
    } )

    await sendToCore( commands, `cc! admin ban someone` )

    expect( ban ).toHaveBeenCalledWith( {}, `someone` )
  } )

  test( `wrong commands and parameters end with described errors`, async() => {
    const commands = new Scope( {}, {
      add: new Executor( { params:[ { name:`a`, type:`number` } ] }, mock() ),
      fail: new Executor( {}, () => {
        throw new Error( `broken command` )
      } ),
    } )

    const errors = await Promise.all( [ `cc! nope`, `cc! add`, `cc! add x`, `cc! add 1 2`, `cc! fail` ].map( async message => {
      const [ response ] = await sendToCore( commands, message )
      return response?.type === `error` ? response.description : response?.type
    } ) )

    expect( errors ).toEqual([ `No command`, `Missing parameter`, `Bad parameter`, `Too many parameters`, `This command has invalid code` ])
  } )

  test( `a command the user has no permissions for is refused`, async() => {
    const secret = mock()
    const commands = new Scope( {}, { secret:new Executor( { perms:`_ADMIN` }, secret ) } )

    const [ response ] = await sendToCore( commands, `cc! secret`, { allowed:false } )

    expect( secret ).not.toHaveBeenCalled()
    expect( response ).toMatchObject({ type:`error`, description:`You have no permissions to do this`, path:[ `secret` ] })
  } )

  test( `the prefix alone shows the help of the root scope`, async() => {
    const commands = new Scope( {}, {
      tools: new Scope( { sd:`Tools` }, { hammer:new Executor( {}, mock() ) } ),
      ping: new Executor( { sd:`Answers pong`, params:[ { name:`times`, type:`number`, optional:true } ] }, mock() ),
    } )

    const [ help ] = await sendToCore( commands, `cc!` )

    expect( help ).toMatchObject({
      type: `help`,
      scopes: [ { name:`tools`, description:`Tools` } ],
      commands: [ { name:`ping`, description:`Answers pong`, params:[ { name:`times`, optional:true, rest:false } ] } ],
    })
  } )
} )

describe( `prefix commands on Discord (through the message handler)`, () => {
  const createModule = () => new DCModule({
    prefix: PREFIX,
    translation: { "err.noPath":`Nie ma takiego polecenia` },
    commands: new Scope( {}, {
      ping: new DCExecutor( {}, $ => $.send( `pong` ) ),
      greet: new DCExecutor( { params:[ { name:`name`, type:`string` } ] }, ($, name) => $.send( `Hi ${name}!` ) ),
      alias: new DCExecutor( {}, $ => $.runCmd( `ping` ) ),
      mods: new DCExecutor( { perms:`Moderator` }, $ => $.sendOk( `moderated` ) ),
      admins: new DCExecutor( { perms:`_ADMIN` }, $ => $.sendOk( `administrated` ) ),
    } ),
  })

  const sendToDiscord = async(content:string, messageConfig?:Parameters<typeof createFakeMessage>[ 1 ]) => {
    const message = createFakeMessage( content, messageConfig )

    handleMessage( createFakeBot( createNamespace( createModule() ) ), message )
    await flushAsyncWork()

    return message
  }

  test( `a command replies in the channel`, async() => {
    expect( (await sendToDiscord( `cc! ping` )).channel.send ).toHaveBeenCalledWith( `pong` )
    expect( (await sendToDiscord( `cc! greet Paweł` )).channel.send ).toHaveBeenCalledWith( `Hi Paweł!` )
  } )

  test( `runCmd runs another command`, async() => {
    expect( (await sendToDiscord( `cc! alias` )).channel.send ).toHaveBeenCalledWith( `pong` )
  } )

  test( `role and _ADMIN permissions`, async() => {
    expect( (await sendToDiscord( `cc! mods`, { member:{ roles:[ `Moderator` ] } } )).channel.send ).toHaveBeenCalledWith( `✅ moderated` )
    expect( (await sendToDiscord( `cc! admins`, { member:{ isAdmin:true } } )).channel.send ).toHaveBeenCalledWith( `✅ administrated` )
    expect( getSentText( await sendToDiscord( `cc! mods` ) ) ).toContain( `You have no permissions to do this` )
  } )

  test( `an error shows the module's translation, the user and the command`, async() => {
    const text = getSentText( await sendToDiscord( `cc! unknown` ) )

    expect( text ).toBe( `**Error** · Nie ma takiego polecenia\n-# <@user-id> · \`unknown\`` )
  } )

  test( `the prefix alone sends the help: the usage of every command, then the legend line by line and the caller`, async() => {
    const text = getSentText( await sendToDiscord( `cc!`, { member:{ isAdmin:true } } ) )

    expect( text ).toStartWith( `### ⚙️ Help for commands` )
    expect( text ).toContain( `\`cc! ping\`` )
    expect( text ).toContain( `\`cc! greet <name>\`` )
    expect( text ).toContain( `\`cc! admins\`` )
    expect( text ).toEndWith( [
      `-# \`<parameter>\` is required`,
      `-# \`[parameter]\` is optional`,
      `-# \`<parameter…>\` takes the rest of the message`,
      `-# Add \`?\` at the end of a command to see its description and parameters`,
      `-# <@user-id> · \`cc!\``,
    ].join( `\n` ) )
  } )

  test( `"?" or "??" at the end shows the command's help instead of running it`, async() => {
    const message = await sendToDiscord( `cc! greet ?` )

    expect( message.channel.send ).not.toHaveBeenCalledWith( expect.stringContaining( `Hi` ) )
    expect( getSentText( message ) ).toContain( `\`cc! greet <name>\`` )
    expect( getSentText( await sendToDiscord( `cc! greet ??` ) ) ).toContain( `**Parameters**\n\`name\` · **required**` )
  } )

  test( `"?" after a group or the prefix alone shows the group's help; permissions still apply`, async() => {
    expect( getSentText( await sendToDiscord( `cc! ?` ) ) ).toContain( `**Commands**` )
    expect( getSentText( await sendToDiscord( `cc! admins ?` ) ) ).toContain( `You have no permissions to do this` )
  } )

  test( `the help and errors reply to the caller's message, without pinging anyone`, async() => {
    const message = await sendToDiscord( `cc!` )
    const sent = message.channel.send.mock.calls[ 0 ]?.[ 0 ] as { reply: { messageReference: unknown }, allowedMentions: unknown }

    expect( sent.reply.messageReference ).toBe( message )
    expect( sent.allowedMentions ).toEqual({ parse:[], repliedUser:false })
    expect( message.delete ).not.toHaveBeenCalled()
  } )

  test( `the help lists only the commands the caller may run`, async() => {
    const memberText = getSentText( await sendToDiscord( `cc!` ) )
    const moderatorText = getSentText( await sendToDiscord( `cc!`, { member:{ roles:[ `Moderator` ] } } ) )

    expect( memberText ).toContain( `\`cc! ping\`` )
    expect( memberText ).not.toContain( `mods` )
    expect( memberText ).not.toContain( `admins` )
    expect( moderatorText ).toContain( `\`cc! mods\`` )
    expect( moderatorText ).not.toContain( `admins` )
  } )
} )
