# 🌵 Cactu framework for Discord.js

`npm i cactu-discord.js`

A Code below is presenting main bot file. This is the easiest code to run the bot. If you want commands or message filters you need to look [GitHub Wiki](https://github.com/PawelekS/Cactu-discord.js/wiki)

```js
// ./app.mjs

import CactuDiscordBot from "cactu-discord.js"

new CactuDiscordBot( { token:`/-secret-/` } )
                          /* ^- configuration object */
```

---

**Note**: Cactu projects are using an `import {} export ""` instead of the `require()`, so you have to use `--experimental-modules` node.js flag, and `.mjs` instead of `js` files extensions

---

## More options? Suggestions? Problems?
If you have features propositions, tell me that [here](https://github.com/PawelekS/Cactu-discord.js/issues).