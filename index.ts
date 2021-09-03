import Discord from "discord.js"
import BotBase from "./src/BotClientBase"

const discord = new Discord.Client()
const botBase = new BotBase( discord )

console.log( botBase )
