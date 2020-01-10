import CactuDiscordBot from "cactu-discord.js"

const cactuBot = new CactuDiscordBot( {
  prefix: `cc!`,
  prefixSpace: true,
  token: `  ==  secret  ==  `,
  spamConfig: {
    roleId: `396710342887211030`,
    interval: 2000,
    points: 10
  },
  evalVars: {
    emit( eventName, ...values ) {
      cactuBot.client.emit( eventName, ...values )
    }
  }
} )