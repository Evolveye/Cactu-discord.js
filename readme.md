# 🌵 Cactu framework for Discord.js 
`npm i cactu-discord.js`

## Preliminary information
The Cactu projects are using an `import {} export ""` instead of the `require()`, so You have to use `--experimental-modules` node flag.

For example:  
`node --experimental-modules app`

## Code
A Code below is presenting main bot file. That is all that You need to run a Discord bot.
```js
import CactuDiscordBot from "cactu-discord.js"

                         /* v config object v */
new CactuDiscordBot( { token:`That's my big secret` } )
```

### Config object
Well - config object is an object with configuration data. Nothing special.
```js
const configObject = {
  token: String, // Discord bot token
  filters: Array, // Filters (more info below)
  commands: Object, // Commands (more info below)
  spamConfig: { // I don't like spammers. You too?
    roleId: String, // Id of role for spammers
    interval: Number, // Milliseconds between last and newly message
    points: Number // Required count of points to get the spammer role
  }

  // If You want more options, tell me that

}
```

## Filters and commands
Does the bot have to filter messages and do actions? 🤔  
Let's create filters and commands!  

Filters and commands code is evaluated by bot, so their code have acces to bot variables:
  * **this**: CactuDiscordBot instance
  * **this.filters**: Filters instance
  * **this.commands**: Commands instance
  * **config**: CactuDiscordBot config
  * **spamConfig**: spam config
  * **bot**: Discord.Client instance
  * **user**: cached current message.author data
  * **msg**: message.content
  * **cache**: CactuDiscordBot cache  
  Cache variable is almost empty namespace. That's a good place for commands variables, which need to be  cached.  
  For example: cache.command_varName = 1

If You want to have filters and commands structures inside other files (recommended), You need to import exported data. For example:
```js
import commands from "./commands.mjs"
import filters from "./filters.mjs"

new CactuDiscordBot( {
  filters,
  commands,
  [`...`]
} )
```

### Filters
All filters are stored inside one array.  
Every filter is a object with methods which names are regular expressions:  
`[/regular expression/] () { /*code*/ }`

Every object method is a next `else if` statement. Look at an example below:
```js
export default [
  // Send "Cactuses >>>>> Roses" on Discord channel
  { [/.*>{5,}.*/] () {
    message.channel.send(`${msg}\nBut as you prefer`)
    message.delete()
  } },


  {
    // #cactus
    [/^#cactus$/] () {
      message.channel.send(`Me? 🌵`)
    },
    // Or long message with "cactus" inside
    [/cactus/] () {
      cache.sendedCactuses++
    }
  },

  // That isn'e a valid Code! That's only a syntax!
  {
    /* if */ [RegExp] () { /* code */ },
    /* else if */ [RegExp] () { /* code */ },
    /* else if */ [RegExp] () { /* code */ }
  }
]
```

### Commands
All commands are stored inside one object.
```js
export default {
  prefix: String, // That's only one required property
  loosePrefix: Boolean, // More info below

  myLang: { // Translated messages
    optionalParam: String, // Optional parameter
    restTypeParam: String, // Any string of characters
    deepestScope: String, // Subset of commands
    noCommand: String, // Command which don't exists
    noParam: String, // Not writed required parameters
    badParam: String, // Not valid parameter
    badRole: String, // User have bad role
    help: String, // Commands help title
  }

  // That's only one required method
  // What bot should do with his messages?
  // That method is sending help message for example
  commandsMessenger( title, description ) {
    message.channel.send( { embed: {
      color: 0x00A000,
      title,
      description
    } } )
  },

  // And the main part
  // Inside that is defined all the commands
  commands: {
    // Deepest commands scope
    god: {
      roles: String || String[] // Needed Discord role(s) name(s)
      desc: String, // Scope description

      bestow(
        params = Object, // More informations below
        roles = String || String[], // Needed role(s)
        desc = String // Command description
      ) {
        // code
      }
    },

    praise(
      params = { what:/sun|moon/ },
      roles = 'Peasant',
      desc = 'Praise the sun (or moon)'
    ) {
      if (!user.praisePoints)
        user.praisePoints = 0

      user.praisePoints++
    }

  }
}
```
Yea, that's really crazy.  
<img src="./what.png" width="25px" height="25px">

#### Loose prefix
The prefix is a first element of the commands. Cactu bot is using `prefix [...scopes] command ...params` syntax. If You don't want space between the prefix and scope/command You need to set `loosePrefix` property on `false`. Examples: with `cc!` prefix:

loosePrefix: true (default)  
`cc! say Hello guys 👋`

loosePrefix: false  
`cc!say Hello again 👋`

#### Scopes
If you want to create deeper scope - another subset of commands - You may create another object inside.  
And the example:
```js
const commands = {
  firstSubset: {
    secondSubset: {
      // Nuff said...
    }
  }
}
```
Inside scopes You may use a two properties: `roles` and `desc`:  
**`roles`**: Name, or array of names of the roles needed to see the scope.  
**`desc`**: Description of the scope.

Example again:
```js
const commands = {
  scopeA: {
    roles: `god`,
    desc: `Commands for god`
  },
  scopeB: {
    roles: [`Peasant`,`villager`]
  },
  scopeC: {
    desc: `Commands for everyone`
  }
}
```
The main `commands` scope does not accept the properties.

#### Commands
Commands are methods.  
Methods have parameters and a code.

Here, parameters are informations about command. These parameters, description, and permissions. The code is a code - nothing much.

Method properties:  
**`params`**: Object which keys are the command names, and values are the command parameters masks (regular expressions).  
**`roles`**: That's a standard. Name, or array of names of the roles needed to see the scope.  
**`desc`**: That's a standard too. Description of the scope.

For example:
```js
commandName(
  params: { amountOfSomething:/\d+/ },
  roles: [`Owner`],
  desc: `IDK what i may write here ¯\\_(ツ)_/¯`
) {
  /* method code */
}
```
Of course, inside the code You can use a variables from `params`.