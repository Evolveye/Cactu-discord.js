# 🌵 Cactu framework for Discord.js; v2.0.0 indev!
`npm i cactu-discord.js`  
Examples and configuration description on [GitHub Wiki](https://github.com/PawelekS/Cactu-discord.js/wiki)

Cactu projects are using an `import {} export ""` instead of the `require()`, so you have to use `--experimental-modules` node.js flag, and `.mjs` instead of `js` files extensions

A Code below is presenting main bot file. That is all that you need to run a Discord bot.
```js
// ./app.mjs

import CactuDiscordBot from "cactu-discord.js"

new CactuDiscordBot( { token:`secret` } )
                          /* ^- configuration object */
```

## More options? Suggestions? Problems?
If you have features propositions, tell me that [here](https://github.com/PawelekS/Cactu-discord.js/issues).