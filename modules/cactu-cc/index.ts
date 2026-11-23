/*
  The Cactu site (cactu.cc): `/cactu-cc login` gives a one-time code for logging in to the site, visible only to the caller;
  `/cactu-cc mc-scan` shows the Minecraft server's satellite scans in the command's channel.
  Needs CACTU_BACKEND_ORIGIN (e.g. http://localhost:3001) and CACTU_BACKEND_API_KEY (the backend's `bot` account key) in the environment;
  CACTU_FRONTEND_ORIGIN (e.g. https://cactu.cc) adds links to the scans on the website.
  The bot never sees sessions or passwords: it only passes the caller's Discord ID to the backend and the code back.
*/

import { ActionRowBuilder, ButtonBuilder, ButtonStyle, MessageFlags } from "discord.js"
import { command, defineModule, group, string } from "cactu-discord.js"
import { NEWEST_BUTTON_ID, OLDER_BUTTON_ID, sendScan, showNewestScan, showOlderScan, suggestWorlds } from "./mcScan/index.js"
import type { ChatInputCommandInteraction } from "discord.js"

type LoginCode = { code: string, expiresAt: number, loginUri: null | string }

/** Why there's no code; `canRetry`: a moment later it may work (vs. a configuration problem or a bug) */
type LoginCodeFailure = { failure: string, canRetry: boolean }

const LOGIN_CODES_PATH = `/api/v1/auth/login-codes`
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
        "mc-scan": command({
          description: `Skan satelitarny serwera Minecraft`,
          params: { world:string().optional().describe( `Świat; bez niego najnowszy skan dowolnego świata` ) },
          message: false, // Only as a slash command: its reply has buttons and an attachment that can take a while
          slash: true,
          autocomplete: { world:(_ctx, typed) => suggestWorlds( typed ) },
          run: async(ctx, { world }) => {
            if (ctx.source === `slash`) await sendScan( ctx.interaction, world )
          },
        }),
      },
    }),
  },

  components: {
    [ `/^${OLDER_BUTTON_ID}(.+)$/` ]: ({ interaction, match }) => interaction.isButton() && match && showOlderScan( interaction, match[ 1 ]! ),
    [ `/^${NEWEST_BUTTON_ID}(.+)$/` ]: ({ interaction, match }) => interaction.isButton() && match && showNewestScan( interaction, match[ 1 ]! ),
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
  const apiKey = process.env.CACTU_BACKEND_API_KEY
  if (!backendOrigin || !apiKey) return { failure:`CACTU_BACKEND_ORIGIN or CACTU_BACKEND_API_KEY isn't set`, canRetry:false } as LoginCodeFailure

  const response = await fetch( backendOrigin + LOGIN_CODES_PATH, {
    method: `POST`,
    headers: { "Authorization":`Bearer ${apiKey}`, "Content-Type":`application/json` },
    body: JSON.stringify({ discordId }),
    signal: AbortSignal.timeout( REQUEST_TIMEOUT ),
  } ).catch( () => null )

  if (!response) return { failure:`the backend didn't answer`, canRetry:true } as LoginCodeFailure

  const body = await response.json().catch( () => null ) as null | Partial<LoginCode>
  if (!body) return { failure:`HTTP ${response.status} without JSON`, canRetry:response.status >= 500 } as LoginCodeFailure

  // A wrong or revoked key: the bot's owner has to replace it
  if (response.status === 401) return { failure:`HTTP 401 ${body.code ?? `?`}, check CACTU_BACKEND_API_KEY`, canRetry:false } as LoginCodeFailure

  // Errors are `{ code:"<ERROR>" }`; DISCORD_UNAVAILABLE and server errors may pass in a moment, the rest are configuration or bugs
  if (!response.ok || typeof body.expiresAt !== `number`) return {
    failure: `HTTP ${response.status} ${body.code ?? `?`}`,
    canRetry: body.code === `DISCORD_UNAVAILABLE` || response.status >= 500,
  } as LoginCodeFailure

  return body as LoginCode
}
