import https from 'https'
import fs from 'fs'

export default class Commands {
  constructor( logger, guildId, prefix, spaceAfterPrefix=true ) {
    this.prefix = prefix
    this.prefixSpace = spaceAfterPrefix

    this.logger = logger
    this.messenger = `
      $.message.channel.send( {
        embed: { description, title, color: 0x00A000 }
      } )
    `

    let configFileName = `${fs.realpathSync( '.' )}/guilds_config/${guildId}-commands`
    let configObject = {}

    if (fs.existsSync( `${configFileName}.js` )) configFileName += '.js'
    else if (fs.existsSync( `${configFileName}.mjs` )) configFileName += '.mjs'
    else configFileName = ''

    if (configFileName != '') {
      configObject = eval( fs
        .readFileSync( configFileName, 'utf8' )
        .match( /^.*?(\( *{[\s\S]*structure *: *{[\s\S]*} *\))$/s )[ 1 ]
      )
    } else configObject = { structure:{} }

    this.structure = Commands.build( Commands.cloneObjects( {}, configObject.structure, Commands.predefinedCommands ) )
    this.setLang( configObject.myLang || {} )
  }

  convert( command, variables, roles=()=>true ) {
    if (!command) return

    let commandCopy = command
    let partedCommand = /^(?<part>\S+)(?: (?<rest>[\s\S]*))?/.exec( command ).groups
    let structScope = this.structure
    let prefixSpace = this.prefixSpace
    let commandPath = this.prefix
    let err = { type:null, value:null, paramMask:null }
    let finallyData = {
      params: [],
      values: [],
      code: []
    }


    /* *
     * Prefix tester */

    if (!(new RegExp( `^${commandPath}` )).test( command )) return
    else if (prefixSpace) {
      if (commandPath !== partedCommand.part) return

      command = partedCommand.rest
    } else if (new RegExp( `^${commandPath} ` ).test( command )) {
      err = { type:'noCommand', value:'' }
      command = ''
    } else command = command.slice( commandPath.length )


    /* *
     * Structure checker & noCommand and badRole errors finder */

    while (partedCommand = /^(?<part>\S+)(?: (?<rest>[\s\S]*))?/.exec( command )) {
      if (!command) break

      let { part, rest } = partedCommand.groups

      if (!(part in structScope)) {
        err = { type:'noCommand', value:part }

        break
      }

      command = rest || ''
      commandPath += ` ${part}`
      structScope = structScope[ part ]

      if (!structScope[ '@roles' ].includes( 'Anyone' ) && !roles( structScope[ '@roles' ] )) {
        err = { type:'badRole' }

        break
      } else if (structScope[ '@code' ]) break
    }

    if (!prefixSpace)
      commandPath = `${commandPath.slice( 0, this.prefix.length )}${commandPath.slice( this.prefix.length + 1 )}`


    /* *
     * Parameters conditions & badParam and noParam errors finder & help builder */

    if (!err.type) {
      if ('@code' in structScope) {
        if (Commands.paramChecker( command, structScope[ '@params' ], err )) {
          finallyData.code = structScope[ '@code' ]
          let params = structScope[ '@params' ]


          for (const param of params) {
            finallyData.params.push( param.name )

            if (!param.value) finallyData.values.push( 'null' )
            else if (param.value <= Number.MAX_SAFE_INTEGER && /^\d+$/.test( param.value ))
              finallyData.values.push( param.value )
            else finallyData.values.push( `\`${param.value.replace(/`/g, `\\\``)}\`` )
          }
        }
      } else { // help builder
        let help = ''

        if (commandPath === this.prefix) help += ''
          + `**[${this.lang.help_optional}]**: abc**?**\n`
          + `**[${this.lang.help_rest}]**: ...abc\n`
          + `**[${this.lang.help_scope}]** ...`

        if (commandPath !== this.prefix || prefixSpace) commandPath += ' '

        for (const name in structScope ) {
          if (name.charAt( 0 ) != '@' && (structScope[ name ][ '@roles' ].includes( 'Anyone' ) || roles( structScope[ name ][ '@roles' ] ))) {
            let field = structScope[ name ]

            help += `\n\n**${commandPath}${name}**`

            if ('@code' in field) {
              help += ':'

              for (const param of field[ '@params' ] ) {
                if (/^\/\^\(\?:[\S ]+\)\{0,1}\//.test( param.mask )) help += `  ${param.name}**?**`
                else if ('/^[\\s\\S]+/' == param.mask) help += `  ...${param.name}`
                else if ('/^[\\s\\S]*/' == param.mask) help += `  ...${param.name}**?**`
                else help += `  ${param.name}`
              }
            } else help += ' ...'

            if ('@desc' in field) help += `\n   ${field[ '@desc' ].replace( /\n/g, '\n   ' )}`
          }
        }

        finallyData.code = this.messenger
        finallyData.params = [ 'title', 'description' ]
        finallyData.values = [ `\`⚙ ${this.lang.help}:\``, `\`${help.replace(/`/g, `\\\``)}\`` ]
      }
    }


    /* *
     * Errors processing */

    if (err.type) {
      switch (err.type) {
        case 'noCommand':
          if (commandPath === this.prefix) commandPath += ' '

          finallyData.values = [
            `\`❌  ${this.lang.err_noCommand}\``,
            `\`👉  \\\`${commandPath} ${err.value}\\\`\``
          ]
        break

        case 'badRole':
          finallyData.values = [
            `\`❌  ${this.lang.err_badRole}\``,
            `\`👉  ${commandPath}\``
          ]
        break

        case 'badParam':
          finallyData.values = [
            `\`❌  ${this.lang.err_badParam}\``,
            `\`👉  ${err.value}\``
          ]
        break

        case 'noParam':
          finallyData.values = [
            `\`❌  ${this.lang.err_noParam}\``,
            `\`👉  ${err.value} \\\`${`${err.paramMask}`.replace( /\\/g, '\\\\' )}\\\`\``
          ]
        break
      }

      finallyData.params = [ 'title', 'description' ]
      finallyData.code = this.messenger
    }


    /* *
     * Evaluation */

    try {
      Commands.eval(
        `( (${finallyData.params.join( ',' )}) => {${finallyData.code}} )(${finallyData.values.join( ',' )})`,
        variables
      )

      this.logger( 'Commands', ':', variables.message.member.displayName, ':', commandCopy )
    }
    catch {
      variables.message.channel.send( this.lang.err_invalidCommand )
    }
  }

  setLang( langPack ) {
    this.lang = {
      err_invalidCommand: langPack.err_invalidCommand || "❌ That command have invalid code!",
      err_noCommand:      langPack.err_noCommand      || "Command doesn't exists",
      err_badParam:       langPack.err_badParam       || "Not valid parameter",
      err_noParam:        langPack.err_noParam        || "You didn't write required parameters",
      err_badRole:        langPack.err_badRole        || "You don't have permissions to use that!",
      help:               langPack.help               || "Help for a syntax of the specified command",
      help_rest:          langPack.help_rest          || "Any string of characters",
      help_scope:         langPack.help_scope         || "Subset of commands",
      help_optional:      langPack.help_optional      || "Optional parameter",
      $_loadCommands:     langPack.$_loadCommands     || "Load the commands from attachment",
      // $_loadFilters:   langPack.$_loadFilters      || "Load the filters from attachment",
      $_loadSucces:       langPack.$_loadSucces       || "✅ File has been loaded",
      $_loadFail:         langPack.$_loadFail         || "❌ Wrong file data!",
      // $_close:         langPack.$_close            || "Securely close the bot`
    }
  }

  static build( structure={} ) {
    const command = {}

    for (const field in structure) {
      if (![ 'function', 'object' ].includes( typeof structure[ field ] )) continue

      if (typeof structure[ field ] == 'function') {
        command[ field ] = Commands.funcData( structure[ field ] )

        const params = command[ field ][ '@params' ]

        for (const param of params) {
          if ( /^\/.*\/$/.test( param.mask ) ) param.mask = eval( `/^${param.mask.substring( 1 )}` )
          else if ( /^['"`']\/.*\/['"`']$/.test( param.mask )) param.mask = eval( `/^(?:${param.mask.slice( 2, -2 )}){0,1}/` )
          else if ( /^['"`']\?\?\?['"`']$/.test( param.mask ) ) param.mask = /^[\s\S]*/
          else if ( /^['"`']!!!['"`']$/.test( param.mask ) ) param.mask = /^[\s\S]+/
        }
      } else if (!Array.isArray( structure[ field ] )) {
        if (!Array.isArray( structure[ field ].roles ))
          structure[ field ].roles = [ structure[ field ].roles || 'Anyone' ]

        command[ field ] = { '@roles':structure[ field ].roles }

        if ('desc' in structure[ field ])
          command[ field ][ '@desc' ] = structure[ field ][ 'desc' ]

        Object.assign( command[ field ], Commands.build( structure[ field ] ) )
      }
    }

    return command
  }

  /**
   * @param {Function} func
   */
  static funcData( func ) {
    const reg = {
      functionCutter: /^(?<name>\w+) *\( *(?<params>[\w\W]*?) *\) *{ *(?<code>[\w\W]*)}$/,

      params: /\w+ *= *(?:{((?!(?<!\\)=).)*}|\[.*?]|['"`].*?['"`]).*?(?=, *|$)/gs,
      paramCutter: /(?<paramName>\w+) *= *(?<paramData>(?:{.*}|\[.*]|['"`].*['"`]))/s,

      objectProperties: /\w+: *['"`]?(?:\/.*?[^\\]\/|\?\?\?|!!!)['"`]?/g,
      objectPropertyCutter: /(?<propertyName>\w+): *(?<propertyValue>.*)/s
    }

    const { name, params, code } = reg.functionCutter.exec( func.toString() ).groups
    const data = {
      '@code': code,
      '@params': [],
      '@roles': [ 'Anyone' ]
    }

    for (const param of params.match( reg.params ) || []) {
      const { paramName, paramData } = reg.paramCutter.exec( param ).groups

      if ([ 'params', 'p' ].includes( paramName )) {
        for (const property of paramData.match( reg.objectProperties )) {
          const { propertyName, propertyValue } = reg.objectPropertyCutter.exec( property ).groups

          data[ '@params' ].push( {
            name: propertyName,
            mask: propertyValue
          } )
        }
      } else if ([ 'roles', 'r' ].includes( paramName )) {
        data[ '@roles' ] = eval( `(${paramData})` )

        if (!Array.isArray( data[ '@roles' ] )) data[ '@roles' ] = [ data[ '@roles' ] ]
      } else if ([ 'desc', 'd' ].includes( paramName )) data[ '@desc' ] = eval( `(${paramData})` )
    }

    return data
  }

  static paramChecker( command, params, errObject ) {
    for (const param of params) {
      if (!param.mask.test( command )) {
        errObject.paramMask = param.mask

        if (!command) {
          errObject.type = 'noParam'
          errObject.value = param.name
        } else {
          errObject.type = 'badParam'
          errObject.value = (command || '').split( ' ' )[0]  ||  ' 👈'
        }

        return false
      }

      param.value = param.mask.exec( command )[ 0 ] || null

      if (param.value) command = command.substr( param.value.length ).trimLeft()
    }

    return true
  }

  static eval( code, $ ) {
    const m = $.message

    eval( code )
  }

  static cloneObjects( target, ...objects ) {
    return objects.reduce( (target, object) => {
      Object.keys( object ).forEach( key => {
        if (typeof object[ key ] == 'object') {
          if (Array.isArray( object[ key ] )) target[ key ] = object[ key ]
          else target[ key ] = this.cloneObjects( target[ key ] || {}, object[ key ] )
        }
        else target[ key ] = object[ key ]
      } )

      return target
    }, target )
  }
}

Commands.predefinedCommands = {
  $: {
    load( r='Owner', p={ what:/c|commands|f|filters/ }, d='Load commands/filters from attached file' ) {
      const attachment = $.message.attachments.first() || {}
      const guildId = $.message.guild.id
      let reg

      if ([ 'c', 'commands' ].includes( what )) {
        what = 'commands'
        reg = /^.*?(\( *{[\s\S]*structure *: *{[\s\S]*} *\))$/s
      } else {
        what = 'filters'
        reg = /^.*?(\[[ \r\n]*{[\s\S]+}[ \r\n]*])$/s
      }

      if (attachment.url && !attachment.width) {
        const extension = attachment.filename.match( /.*\.([a-z]+)/ )[ 1 ] || 'mjs'
        const fileName = `${fs.realpathSync( '.' )}/guilds_config/${guildId}-${what}.${extension}`
        const file = fs.createWriteStream( fileName )

        https.get( attachment.url, res => {
          res.pipe( file ).on( 'finish', () => {
            file.close()

            let object = fs.readFileSync( fileName, 'utf8' )
            let guildDb = $.bot.guildsDbs.get( guildId )

            try {
              if (!reg.test( object )) throw ''

              object = eval( object.match( reg )[ 1 ] )

              if (what == 'commands') {
                guildDb.commands.structure = Commands.build( Commands.cloneObjects( object.structure, Commands.predefinedCommands ) )
                guildDb.commands.setLang( object.myLang )
              } else guildDb.filters.setFilters( object )

              $.message.channel.send( guildDb.commands.lang.$_loadSucces )
            }
            catch (err) {
              $.message.channel.send( guildDb.commands.lang.$_loadFail )
              fs.unlink( fileName, () => {} )

              console.log( 'ERROR', guildId, '->', err )
            }
          } )
        } )
      }
    },
    botOperator( r='Owner', p={ roleName:'???' }, d='Set the role which will have owner permissions for bot' ) {
      if (!roleName) {
        $.bot.botOperatorId = null

        return
      }

      const role = $.message.guild.roles.find( 'name', roleName )

      if (role) {
        $.bot.botOperatorId = role.id
        $.message.channel.send( "✅ Bot operator has been setted successfully set" )
      } else $.message.channel.send( "❌ That role doesn't exists" )
    }
  }
}