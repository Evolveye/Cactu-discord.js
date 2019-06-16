import CactuDiscordBot from "cactu-discord.js"

const cactuBot = new CactuDiscordBot( {
  token: `secret`,
  spamConfig: {
    roleId: `396710342887211030`,
    interval: 2000,
    points: 10
  }
} )

cactuBot.evalVars.numOfThatBoTRun = Math.floor( Math.random() * 100 )