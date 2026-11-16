/*
  The Cactu site (cactu.cc): `/cactu-cc login` gives a one-time code for logging in to the site, visible only to the caller.
  Needs CACTU_BACKEND_ORIGIN (e.g. http://localhost:3001) and CACTU_BOT_SECRET (the backend's secret) in the environment.
  The bot never sees sessions or passwords: it only passes the caller's Discord ID to the backend and the code back.
*/

import { ActionRowBuilder, ButtonBuilder, ButtonStyle, MessageFlags } from "discord.js"
import { command, defineModule, group } from "cactu-discord.js"
import type { ChatInputCommandInteraction } from "discord.js"

type LoginCode = { code: string, expiresAt: number, loginUri: null | string }

/** Why there's no code; `canRetry`: a moment later it may work (vs. a configuration problem or a bug) */
type LoginCodeFailure = { failure: string, canRetry: boolean }

const LOGIN_CODES_PATH = `/api/auth/login-codes`
const REQUEST_TIMEOUT = 1000 * 10

const RETRY_SOON_MESSAGE = `Nie udało się teraz przygotować kodu. Spróbuj ponownie za chwilę.`
const FAILED_MESSAGE = `Coś poszło nie tak. Spróbuj ponownie później.`

export default defineModule({
  commands: {
    "cactu-cc": group({
      description: `Strona Cactu (cactu.cc)`,
      commands: {
        login: command({
          description: `Zaloguj się na stronę Cactu`,
          message: false, // Only as a slash command: its reply can be seen by the caller alone, a text command's can't
          slash: true,
          run: async ctx => {
            if (ctx.source === `slash`) await sendLoginCode( ctx.interaction )
          },
        }),
      },
    }),
  },
})

async function sendLoginCode( interaction:ChatInputCommandInteraction ) {
  // The code logs in as the caller, so nobody else may see it; deferring also gives the backend more than Discord's 3 seconds
  await interaction.deferReply({ flags:MessageFlags.Ephemeral })

  const loginCode = await requestLoginCode( interaction.user.id )

  if (`failure` in loginCode) {
    console.log( `cactu-cc: no login code for a user (${loginCode.failure})` )
    return interaction.editReply( loginCode.canRetry ? RETRY_SOON_MESSAGE : FAILED_MESSAGE )
  }

  const loginButtonRow = createLoginButtonRow( loginCode.loginUri )
  const codeOnlyReply = { content:describeLoginCode( loginCode, false ), components:[] }
  if (!loginButtonRow) return interaction.editReply( codeOnlyReply )

  // Discord may still refuse the link (e.g. a local address); the code alone is enough to log in, so it gets sent anyway
  return interaction.editReply({ content:describeLoginCode( loginCode, true ), components:[ loginButtonRow ] }).catch( (error:Error & { code?: unknown }) => {
    console.log( `cactu-cc: Discord refused the login button (${error.name} ${error.code ?? ``}, link: ${describeLink( loginCode.loginUri! )}), sending the code alone` )
    return interaction.editReply( codeOnlyReply )
  } )
}

function describeLoginCode( loginCode:LoginCode, hasButton:boolean ) {
  return [
    `**Kod logowania: \`${loginCode.code}\`** · wygasa <t:${Math.floor( loginCode.expiresAt / 1000 )}:R>`,
    hasButton ? `Wpisz go w okienku logowania na stronie albo kliknij przycisk poniżej.` : `Wpisz go w okienku logowania na stronie.`,
    `Nie podawaj nikomu tego kodu: kto go zna, może zalogować się jako Ty.`,
  ].join( `\n` )
}

/** The one-click login button; none without a link, or when the link isn't an http(s) URL (the backend's CACTU_FRONTEND_ORIGIN) */
function createLoginButtonRow( loginUri:null | string ) {
  if (!loginUri) return null

  if (!URL.canParse( loginUri ) || !/^https?:$/.test( new URL( loginUri ).protocol )) {
    console.log( `cactu-cc: the backend's login link isn't an http(s) URL (${describeLink( loginUri )}), check its CACTU_FRONTEND_ORIGIN` )
    return null
  }

  return new ActionRowBuilder<ButtonBuilder>().addComponents( new ButtonBuilder().setStyle( ButtonStyle.Link ).setLabel( `Zaloguj na stronie` ).setURL( loginUri ) )
}

/** The link without its `#…` and `?…` parts, which hold the code: safe for the logs */
function describeLink( loginUri:string ) {
  return loginUri.split( /[#?]/ )[ 0 ]
}

/** Asks the backend for the user's login code; each user has one, so asking again replaces the previous one */
async function requestLoginCode( discordId:string ) {
  const backendOrigin = process.env.CACTU_BACKEND_ORIGIN?.replace( /\/+$/, `` )
  const secret = process.env.CACTU_BOT_SECRET
  if (!backendOrigin || !secret) return { failure:`CACTU_BACKEND_ORIGIN or CACTU_BOT_SECRET isn't set`, canRetry:false } as LoginCodeFailure

  const response = await fetch( backendOrigin + LOGIN_CODES_PATH, {
    method: `POST`,
    headers: { "Authorization":`Bearer ${secret}`, "Content-Type":`application/json` },
    body: JSON.stringify({ discordId }),
    signal: AbortSignal.timeout( REQUEST_TIMEOUT ),
  } ).catch( () => null )

  if (!response) return { failure:`the backend didn't answer`, canRetry:true } as LoginCodeFailure

  const body = await response.json().catch( () => null ) as null | Partial<LoginCode>
  if (!body) return { failure:`HTTP ${response.status} without JSON`, canRetry:response.status >= 500 } as LoginCodeFailure

  // Errors are `{ code:"<ERROR>" }`; DISCORD_UNAVAILABLE and server errors may pass in a moment, the rest are configuration or bugs
  if (!response.ok || typeof body.expiresAt !== `number`) return {
    failure: `HTTP ${response.status} ${body.code ?? `?`}`,
    canRetry: body.code === `DISCORD_UNAVAILABLE` || response.status >= 500,
  } as LoginCodeFailure

  return body as LoginCode
}
