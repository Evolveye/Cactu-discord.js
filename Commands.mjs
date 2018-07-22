export default class Commands {
  constructor( config={} ) {

    // Required config data test
    if (!config.prefix)
      throw new Error( `Your commands need to have the prefix!` )
    if (!config.commandsMessenger)
      throw new Error( `Your commands need to have the messenger!` )
    if (!config.structure)
      throw new Error( `Your commands need to have commands! (:thinking:)` )

    // Setting a variables
    this.prefix = config.prefix
    this.loosePrefix = `loosePrefix` in config  ?  !!config.loosePrefix  :  true

    let lang = config.myLang || {}

    this.optionalParam  =  lang.optionalParam  ||  `Optional parameter`
    this.restTypeParam  =  lang.restTypeParam  ||  `Any string of characters`
    this.deepestScope   =  lang.deepestScope   ||  `Subset of commands`
    this.noCommand      =  lang.noCommand      ||  `Command don't exists`
    this.badParam       =  lang.badParam       ||  `Not valid parameter`
    this.noParam        =  lang.noParam        ||  `You didn't write required parameters`
    this.badRole        =  lang.badRole        ||  `You don't have permissions to use that!`
    this.help           =  lang.help           ||  `Help for a syntax of the specified command`

    this.structure = {}

    let messenger = /\{([\s\S]+)\}|=>([\s\S]+)/.exec( config.commandsMessenger )
    this.messenger = messenger[1] || messenger[2]

    // Build the commands
    Object.assign( this.structure, Commands.builder( config.structure ) )
  }

  convert( command, roles ) {
    if (!command)
      return

    // Initiating operations
    let partedCommand = /^(?<part>\S+)(?: (?<rest>[\s\S]*))?/.exec( command ).groups
    let loosePrefix = this.loosePrefix
    let structDimension = this.structure
    let commandPath = this.prefix
    let finallyData = {
      params: [],
      values: [],
      code: []
    }
    let err = { type:null, value:null }

    // Prefix test
    if (!(new RegExp( `^${commandPath}` )).test( command ))
      return
    else if (loosePrefix) {
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

      if (!(part in structDimension)) {
        err = { type:`noCommand`, value:part }
        break
      }

      command = rest || ``
      commandPath += ` ${part}`
      structDimension = structDimension[part]

      if (!structDimension[`@roles`].includes( `Anyone` ) && !roles( structDimension[`@roles`] )) {
        err = { type:'badRole' }
        break
      }
      else if (structDimension[`@code`])
        break
    }

    if (!loosePrefix)
      commandPath = `${commandPath.slice( 0, this.prefix.length )}${commandPath.slice( this.prefix.length + 1 )}`


    // Parameters conditions & badParam and noParam errors finder
    if (!err.type) {
      if (structDimension[`@code`] && Commands.paramChecker( command, structDimension[`@params`], err )) {
        finallyData.code = structDimension[`@code`]
        let params = structDimension[`@params`]
  
        for (let param of params) {
          finallyData.params.push( param.name )
  
          if (/^\d+$/.test( param.value ))
            finallyData.values.push( param.value )
          else 
            finallyData.values.push( `\`${param.value.replace(/`/g, `\\\``)}\`` )
        }
      }
      else {
        let help = ``

        if (commandPath === this.prefix)
          help += ''
            + `**[${this.optionalParam}]**:    abc **?**\n`
            + `**[${this.restTypeParam}]**:    ...abc\n`
            + `**[${this.deepestScope}]** ...`

        if (commandPath !== this.prefix || loosePrefix)
          commandPath += ` `

        for (let i in structDimension) {
          if (i.charAt( 0 ) != `@` && (structDimension[i][`@roles`].includes( `Anyone` ) || roles( structDimension[i][`@roles`] ))) {
            let field = structDimension[i]

            help += `\n\n**${commandPath}${i}**`

            if (`@code` in field) {
              help += `:`
              for (let param of field[`@params`]) {
                if (/^\/\^\(\?:[\S ]+\)\{0,1}\//.test( param.mask ))
                  help += `    ${param.name} **?**`
                else if (`/^[\\s\\S]+/` === param.mask)
                  help += `    ...${param.name}`
                else if (`/^[\\s\\S]*/` === param.mask)
                  help += `    ...${param.name} **?**`
                else
                  help += `    ${param.name}`
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
        finallyData.values = [`\`⚙ ${this.help}:\``,`\`${help.replace(/`/g, `\\\``)}\``]
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
          finallyData.values = [`\`❌  ${this.noParam}\``,`\`👉  ${err.value}\``]
        break
      }
      finallyData.params = [`title`, `description`]
      finallyData.code = this.messenger
    }

    return `( (${finallyData.params.join( ',' )}) => {${finallyData.code}} )(${finallyData.values.join( ',' )})`
  }

  static builder( structure={} ) {
    let command = {}

    for (let field in structure) {
      if (![`function`,`object`].includes( typeof structure[field] ))
        continue

      if (typeof structure[field] === `function`) {
        command[field] = Commands.funcData( structure[field] )

        let params = command[field][`@params`]
        for (let param of params)
          if (/^\/.*\/$/.test( param.mask ))
            param.mask = eval( `/^${param.mask.substring( 1 )}` )
          else if (/^['"`']\/.*\/['"`']$/.test( param.mask ))
            param.mask = eval(`/^(?:${param.mask.slice( 2, -2 )}){0,1}/`)
          else if (/^['"`']\?\?\?['"`']$/.test( param.mask ))
            param.mask = /^[\s\S]*/
          else if (/^['"`']!!!['"`']$/.test( param.mask ))
            param.mask = /^[\s\S]+/
      }
      else if (!Array.isArray( structure[field] )) {
        if (!Array.isArray( structure[field].roles ))
          structure[field].roles = [structure[field].roles  ||  `Anyone`]

        command[field] = { "@roles":structure[field].roles }

        if (`desc` in structure[field])
          command[field][`@desc`] = structure[field][`desc`]

        Object.assign( command[field], Commands.builder( structure[field] ) )
      }
    }
  
    return command
  }

  static funcData( func ) {
    let parted  =  /^(\w+)\(([\w\W]*?)\)[ ]*{([\w\W]*)}$/.exec( func.toString() )
    // let lines   =  parted[3].split( /\r?\n/ )
    let data    =  {
      "@code": parted[3],
      "@params": [],
      "@roles": [`Anyone`]
    }

    let matched, param
    let dataReg   = /(\w+)[ ]*=[ ]*([\{\['"`].*[\}\]'"`])/g
    let paramReg  = /(\w+):(['"`]?(?:\/.*?[^\\]\/|\?\?\?|!!!)['"`]?)/g

    while (matched = dataReg.exec( parted[2] )) {
      if (matched[1] === `params`) {
        while (param = paramReg.exec( matched[2] ))
          data[`@params`].push( {
            name: param[1],
            mask: param[2]
          } )

      }
      else if (matched[1] == `roles`) {
        data[`@roles`] = eval(`(${matched[2]})`)

        if (!Array.isArray( data[`@roles`] ))
          data[`@roles`] = [data[`@roles`]]

      }
      else
        data[`@${matched[1]}`] = eval( `(${matched[2]})` )
    }
    return data
  }

  static paramChecker( command, params, errObject ) {
    for (let param of params) {
      if (!param.mask.test( command )) {
        if (!command)
          errObject = { type:`noParam`, value:param.name }
        else
          errObject = { type:`badParam`, value:(command || ``).split( ` ` )[0]  ||  ` 👈` }
        return false
      }

      if( command )
        command = command.substr( (param.value = param.mask.exec( command )[0]).length ).trimLeft()
    }
    return true
  }
}