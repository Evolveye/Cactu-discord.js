/* Local bot runner: `bun run dev` from the repository root. Secrets live in playground/.env (template: .env.example). */

import CactuDiscordBot from "../index.js"

const botToken = process.env.BOT_TOKEN
if (!botToken) throw new Error( `Missing BOT_TOKEN in playground/.env` )

const appId = process.env.APP_ID
if (!appId) throw new Error( `Missing APP_ID in playground/.env` )

/** The running bot, exported for inspection while debugging */
export const bot = new CactuDiscordBot({ botToken, appId, appOwnerId:process.env.APP_OWNER_ID })
