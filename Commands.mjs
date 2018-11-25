import https from "https"
import fs from "fs"



export default class Commands {
  constructor( guildsIds=[], prefix=`cc!`, prefixSpace=true ) {
    // Prefix
    this.prefix = prefix
    this.prefixSpace = prefixSpace

    // Lang
    let lang = {}
    this.lang = {
      err_noCommand:  lang.err_noCommand  || `Command don't exists`,
      err_badParam:   lang.err_badParam   || `Not valid parameter`,
      err_noParam:    lang.err_noParam    || `You didn't write required parameters`,
      err_badRole:    lang.err_badRole    || `You don't have permissions to use that!`,
      help:           lang.help           || `Help for a syntax of the specified command`,
      help_rest:      lang.help_rest      || `Any string of characters`,
      help_scope:     lang.help_scope     || `Subset of commands`,
      help_optional:  lang.help_optional  || `Optional parameter`,
      $_loadCommands: lang.$_loadCommands || `Load the commands from attachment`,
      $_loadFilters:  lang.$_loadFilters  || `Load the filters from attachment`,
      $_loadSucces:   lang.$_loadSucces   || `✅ Commands has been loaded`,
      $_loadFail:     lang.$_loadFail     || `❌ Wrong commands file!`,
      $_close:        lang.$_close        || `Securely close the bot`
    }

    // Messenger
    this.messenger = `
      $.message.channel.send( {
        embed: { description, title, color: 0x00A000 }
      } )
    `

    // Command structure
    this.prefixHelpBoxFirstInfo = ``
      + `**[${this.lang.help_optional}]**: abc**?**\n`
      + `**[${this.lang.help_rest}]**: ...abc\n`
      + `**[${this.lang.help_scope}]** ...`

    if (!fs.existsSync( `./guilds_config/` ))
      fs.mkdirSync( `./guilds_config/` )

    this.structures = new Map
    fs.readdir( `./guilds_config/`, (err, files) =>
      files.forEach( fileName => {
        let guildId = fileName.split( `-` )[0]

        if (guildsIds.includes( guildId )) {
          let object = eval( fs.readFileSync( `./guilds_config/${fileName}`, `utf8` ) )
          let structure = Commands.build( Commands.cloneObjects( {}, object.structure, Commands.predefinedCommands ) )
          this.structures.set( guildId, structure )
        }
        else
          fs.unlink( fileName )
      } )
    )
  }

  convert( guildId, command, roles, variables ) {
    if (!guildId || !command)
      return

    // Initiating operations
    let partedCommand = /^(?<part>\S+)(?: (?<rest>[\s\S]*))?/.exec( command ).groups
    let structScope = this.structures.get( guildId )
    let prefixSpace = this.prefixSpace
    let commandPath = this.prefix
    let err = { type:null, value:null, paramMask:null }
    let finallyData = {
      params: [],
      values: [],
      code: []
    }

    // Prefix test
    if (!(new RegExp( `^${commandPath}` )).test( command ))
      return
    else if (prefixSpace) {
      if (commandPath !== partedCommand.part)
        return

      command = partedCommand.rest
    }
    else if (new RegExp( `^${commandPath} ` ).test( command )) {
      err = { type:`noCommand`, value:`` }
      command = ``
    } 
    else
      command = command.slice( commandPath.length )

    // Structure checker & noCommand and badRole errors finder
    while (partedCommand = /^(?<part>\S+)(?: (?<rest>[\s\S]*))?/.exec( command )) {
      if (!command)
        break
      
      let {part, rest} = partedCommand.groups

      if (!(part in structScope)) {
        err = { type:`noCommand`, value:part }
        break
      }

      command = rest || ``
      commandPath += ` ${part}`
      structScope = structScope[part]

      if (!structScope[`@roles`].includes( `Anyone` ) && !roles( structScope[`@roles`] )) {
        err = { type:'badRole' }
        break
      }
      else if (structScope[`@code`])
        break
    }

    if (!prefixSpace)
      commandPath = `${commandPath.slice( 0, this.prefix.length )}${commandPath.slice( this.prefix.length + 1 )}`

    // Parameters conditions & badParam and noParam errors finder & help builder
    if (!err.type) {
      if (`@code` in structScope) {
        if (Commands.paramChecker( command, structScope[`@params`], err )) {
          finallyData.code = structScope[`@code`]
          let params = structScope[`@params`]

    
          for (let param of params) {
            finallyData.params.push( param.name )

            if (!param.value)
              finallyData.values.push( `null` )
            else if (param.value <= Number.MAX_SAFE_INTEGER && /^\d+$/.test( param.value ))
              finallyData.values.push( param.value )
            else 
              finallyData.values.push( `\`${param.value.replace(/`/g, `\\\``)}\`` )
          }
        }
      }
      else { // help builder
        let help = ``

        if (commandPath === this.prefix)
          help += this.prefixHelpBoxFirstInfo

        if (commandPath !== this.prefix || prefixSpace)
          commandPath += ` `

        for (let name in structScope) {
          if (name.charAt( 0 ) != `@` && (structScope[name][`@roles`].includes( `Anyone` ) || roles( structScope[name][`@roles`] ))) {
            let field = structScope[name]

            help += `\n\n**${commandPath}${name}**`
            if (`@code` in field) {
              help += `:`
              for (let param of field[`@params`]) {
                if (/^\/\^\(\?:[\S ]+\)\{0,1}\//.test( param.mask ))
                  help += ` ${param.name}**?**`
                else if (`/^[\\s\\S]+/` == param.mask)
                  help += ` ...${param.name}`
                else if (`/^[\\s\\S]*/` == param.mask)
                  help += ` ...${param.name}**?**`
                else
                  help += ` ${param.name}`
              }
            }
            else
              help += ` ...`
            if (`@desc` in field)
              help += `\n   ${field[`@desc`].replace( /\n/g, `\n   ` )}`
          }

        }

        finallyData.code = this.messenger
        finallyData.params = [`title`, `description`]
        finallyData.values = [`\`⚙ ${this.lang.help}:\``,`\`${help.replace(/`/g, `\\\``)}\``]
      }
    }

    // Errors processing
    if (err.type) {
      switch (err.type) {
        case `noCommand`:
          if (commandPath === this.prefix)
            commandPath += ` `
            
          finallyData.values = [`\`❌  ${this.noCommand}\``,`\`👉  \\\`${commandPath}${err.value}\\\`\``]
        break
        case `badRole`: 
          finallyData.values = [`\`❌  ${this.badRole}\``,`\`👉  ${commandPath}\``]
        break
        case `badParam`:
          finallyData.values = [`\`❌  ${this.badParam}\``,`\`👉  ${err.value}\``]
        break
        case `noParam`:
          finallyData.values = [`\`❌  ${this.noParam}\``,`\`👉  ${err.value} \\\`${err.paramMask}\\\`\``]
        break
      }
      finallyData.params = [`title`, `description`]
      finallyData.code = this.messenger
    }

    Commands.eval(
      `( (${finallyData.params.join( ',' )}) => {${finallyData.code}} )(${finallyData.values.join( ',' )})`,
      variables
    )
  }

  static build( structure={} ) {
    let command = {}

    for (let field in structure) {
      if (![`function`,`object`].includes( typeof structure[field] ))
        continue
        
      if (typeof structure[field] === `function`) {
        command[field] = Commands.funcData( structure[field] )
          
        let params = command[field][`@params`]
        for (let param of params) {
          if (/^\/.*\/$/.test( param.mask ))
            param.mask = eval( `/^${param.mask.substring( 1 )}` )
          else if (/^['"`']\/.*\/['"`']$/.test( param.mask ))
            param.mask = eval(`/^(?:${param.mask.slice( 2, -2 )}){0,1}/`)
          else if (/^['"`']\?\?\?['"`']$/.test( param.mask ))
            param.mask = /^[\s\S]*/
          else if (/^['"`']!!!['"`']$/.test( param.mask ))
            param.mask = /^[\s\S]+/
        }
      }
      else if (!Array.isArray( structure[field] )) {
        if (!Array.isArray( structure[field].roles ))
          structure[field].roles = [structure[field].roles  ||  `Anyone`]
          
        command[field] = { "@roles":structure[field].roles }
          
        if (`desc` in structure[field])
          command[field][`@desc`] = structure[field][`desc`]
          
        Object.assign( command[field], Commands.build( structure[field] ) )
      }
    }

    return command
  }

  /**
   * @param {Function} func 
   */
  static funcData( func ) {
    let reg = {
      functionCutter: /^(?<name>\w+) *\( *(?<params>[\w\W]*?) *\) *{ *(?<code>[\w\W]*)}$/,
    
      params: /\w+ *= *(?:{((?!(?<!\\)=).)*}|\[.*?]|['"`].*?['"`]).*?(?=, *|$)/gs,
      paramCutter: /(?<paramName>\w+) *= *(?<paramData>(?:{.*}|\[.*]|['"`].*['"`]))/s,
    
      objectProperties: /\w+: *['"`]?(?:\/.*?[^\\]\/|\?\?\?|!!!)['"`]?/g,
      objectPropertyCutter: /(?<propertyName>\w+): *(?<propertyValue>.*)/s
    }

    let { name, params, code } = reg.functionCutter.exec( func.toString() ).groups
    let data = {
      "@code": code,
      "@params": [],
      "@roles": [`Anyone`]
    }

    for (let param of params.match( reg.params )) {
      let { paramName, paramData } = reg.paramCutter.exec( param ).groups

      if ([ `params`, `p` ].includes( paramName )) {
        for (let property of paramData.match( reg.objectProperties )) {
          let {propertyName, propertyValue} = reg.objectPropertyCutter.exec( property ).groups
          data[`@params`].push( {
            name: propertyName,
            mask: propertyValue
          } )
        }
      }
      else if ([ `roles`, `r` ].includes( paramName )) {
        data[`@roles`] = eval(`(${paramData})`)

        if (!Array.isArray( data[`@roles`] ))
          data[`@roles`] = [data[`@roles`]]

      }
      else if ([ `desc`, `d` ].includes( paramName ))
        data[`@desc`] = eval( `(${paramData})` )
    }
    
    return data
  }

  static paramChecker( command, params, errObject ) {
    for (let param of params) {
      if (!param.mask.test( command )) {
        errObject.paramMask = param.mask

        if (!command) {
          errObject.type = `noParam`
          errObject.value = param.name
        }
        else {
          errObject.type = `badParam`
          errObject.value = (command || ``).split( ` ` )[0]  ||  ` 👈`
        }
        return false
      }

      param.value = param.mask.exec( command )[0] || null

      if (param.value)
        command = command.substr( param.value.length ).trimLeft()
    }
    return true
  }

  static eval( code, $ ) {
    eval( code )
  }

  static cloneObjects( target, ...objects ) {
    return objects.reduce( (target, object) => {
      Object.keys( object ).forEach( key => {
        if (typeof object[key] === `object`)
          target[key] = this.cloneObjects( target[key] || {}, object[key] )
        else
          target[key] = object[key]
      } )
      return target
    }, target )
  }
}

Commands.predefinedCommands = {
  $: {
    //loadCommands( roles=`Owner`, params={ what:/commands|filters/ }, desc=xxx ) {
    load( roles=`Owner`, desc=`Load commands from attachment to bot` ) {
      let attachment = $.message.attachments.first() || {}
      let guildId = $.message.guild.id

      if (attachment.url && !attachment.width) {
        let fileName = `./guilds_config/${guildId}-${$.message.guild.name}.js`

        const file = fs.createWriteStream( fileName )
        https.get( attachment.url, res => {
          res.pipe( file ).on( `finish`, () => {
            file.close()
            let object = fs.readFileSync( fileName, `utf8` )

            if (!/\( *{[\s\S]*structure *: *{[\s\S]*} *\)/.test( object ))
              $.message.channel.send( $.bot.commands.lang.$_loadFail )
            else {
              object = eval( object )
              $.message.channel.send( $.bot.commands.lang.$_loadSucces )
              $.bot.commands.structures.set( guildId,
                Commands.build( Commands.cloneObjects( object.structure, Commands.predefinedCommands ) )
              )
            }
          } )
        } )
      }
    }
  }
}