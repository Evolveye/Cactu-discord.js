# 🌵 Cactu framework for Discord.js
`npm i cactu-discord.js`  
Examples and configuration description on [GitHub Wiki](https://github.com/PawelekS/Cactu-discord.js/wiki)

Cactu projects are using an `import {} export ""` instead of the `require()`, so you have to use `--experimental-modules` node.js flag, and `.mjs` instead of `js` files extensions or `"type": "module"` field in package.json

Look into `example_config/` folder for *example config*

## Screens with bot in action

Bot without commands:  
![First run - without commands](https://raw.githubusercontent.com/Evolveye/Cactu-discord.js/master/img/before_load.png)

Error handling (on screen you can see only one error)  
![First run - attempt to load commands without file](https://raw.githubusercontent.com/Evolveye/Cactu-discord.js/master/img/before_load-error.png)

Example commands loading (information about loaded commands is from `commands.mjs`)  
![Loading the commands](https://raw.githubusercontent.com/Evolveye/Cactu-discord.js/master/img/before_load-loading.png)  
![bad guy want to load own commands](https://raw.githubusercontent.com/Evolveye/Cactu-discord.js/master/img/bad_guy.png)

Loaded commands are working immediately after loading  
![New commands](https://raw.githubusercontent.com/Evolveye/Cactu-discord.js/master/img/new_cmds.png)  
![New commands working!](https://raw.githubusercontent.com/Evolveye/Cactu-discord.js/master/img/new_cmds-working.png)

Example of filters  
![Filters](https://raw.githubusercontent.com/Evolveye/Cactu-discord.js/master/img/filters.png)

And logs on the end  
![Logs](https://raw.githubusercontent.com/Evolveye/Cactu-discord.js/master/img/logs.png)