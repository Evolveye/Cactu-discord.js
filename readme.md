# 🌵 Cactu framework for Discord.js
`npm i cactu-discord.js`  
Examples and configuration description on [GitHub Wiki](https://github.com/PawelekS/Cactu-discord.js/wiki)

Cactu projects are using an `import {} export ""` instead of the `require()`, so you have to use `--experimental-modules` node.js flag, and `.mjs` instead of `js` files extensions or `"type": "module"` field in package.json

Look into `example_config/` folder for *example config*

## Screens with bot in action

Bot without commands:  
<img src=./img/before_load.png>

Error handling (on screen you can see only one error)  
<img src=./img/before_load-error.png>

Example commands loading (information about loaded commands is from `commands.mjs`)  
<img src=./img/before_load-loading.png>

Loaded commands are working immediately after loading  
<img src=./img/new_cmds.png>  
<img src=./img/new_cmds-working.png>

Example of filters  
<img src=./img/filters.png>

And logs on the end  
<img src=./img/logs.png>