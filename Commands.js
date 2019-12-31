import https from 'https'
import fs from 'fs'

class CommandData {
  constructor( command, partedCommand, structure ) {
    this.command = command.trim(),
    this.path = '',
    this.parts = partedCommand,
    this.structure = structure,
    this.response = { code:[], params:[], values:[] },
    this.err = { type:null, value:null, paramMask:null }
  }
}

export default class Commands {
  /**
   * @param {Logger} logger
   * @param {string} guildId
   * @param {string} prefix
   * @param {boolean} spaceAfterPrefix
   */
  constructor( logger, guildId, prefix, spaceAfterPrefix=true ) {
    this.prefix = prefix
    this.prefixSpace = spaceAfterPrefix
    this.events = {}

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

    Object.keys( configObject )
      .filter( key => key.startsWith( 'on' ) )
      .forEach( key => this.events[ key.slice( 2 ) ] = configObject[ key ] )
  }

  /**
   * @param {string} command
   * @param {any} variables
   * @param {function(string[]): boolean} rolesTest
   */
  execute( command, variables, rolesTest=()=>true ) {
    if (!command) return

    const data = new CommandData( command, this.partCommand( command ), this.structure )
    const err = data.err

    if (!this.checkPrefix( data )) return

    if (!err.type) this.checkAccesToStructure( data, rolesTest )
    if (!err.type) this.buildResponse( data, rolesTest )

    if (err.type) this.processErrors( data )

    try {
      const { params, values, code } = data.response

      Commands.eval( `( (${params.join( ',' )}) => {${code}} )(${values.join( ',' )})`, variables )

      this.logger( 'Commands', ':', variables.message.member.displayName, ':', command )
    }
    catch {
      variables.message.channel.send( this.lang.err_invalidCommand )
    }
  }

  /**
   * @param {any} langPack
   */
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

  /**
   * @param {any} err
   * @param {string} type
   * @param {string} value
   */
  setError( err, type, value ) {
    err.type = type
    err.value = value
  }

  /**
   * @param {string} command
   */
  partCommand( command ) {
    const { groups } = /^(?<part>\S+)(?: +(?<rest>[\s\S]*))?/.exec( command ) || { groups:{} }

    if (!groups.part) groups.part = ''
    if (!groups.rest) groups.rest = ''

    return groups
  }

  /**
   * @param {CommandData} commandData
   */
  checkPrefix( commandData ) {
    const { prefix, prefixSpace } = this
    const { command, parts } = commandData

    if (!command.startsWith( prefix )) return false
    if (prefixSpace) {
      if (prefix !== parts.part) return false
    } else {
      if (parts.part === prefix && parts.rest !== '') return false
    }


    if (prefixSpace) commandData.command = parts.rest
    else commandData.command = command.slice( prefix.length )

    return true
  }

  /**
   * @param {CommandData} commandData
   * @param {function(string[]): boolean} rolesTest
   */
  checkAccesToStructure( commandData, rolesTest ) {
    const { prefix, prefixSpace } = this
    let { command, path, structure, parts, err } = commandData

    while ((parts = this.partCommand( command )).part !== '') {
      if (!command) break

      const { part, rest } = parts

      if (!(part in structure)) {
        this.setError( err, 'noCommand', part )
        break
      }

      command = rest || ''
      path += ` ${part}`
      structure = structure[ part ]

      if (structure[ '@code' ]) break
      else if (!structure[ '@roles' ].includes( 'Anyone' ) && !rolesTest( structure[ '@roles' ] )) {
        this.setError( err, 'badRole' )
        break
      }
    }

    if (prefixSpace) path = `${prefix}${path}`
    else path = `${prefix}${path.slice( 1 )}`

    commandData.command = command
    commandData.path = path
    commandData.parts = parts
    commandData.structure = structure
  }

  /**
   * @param {CommandData} commandData
   * @param {function(string[]): boolean} rolesTest
   */
  buildResponse( commandData, rolesTest ) {
    const { command, structure, err, response } = commandData
    const { prefix, prefixSpace, lang } = this

    if ('@code' in structure) {
      if (Commands.paramChecker( command, structure[ '@params' ], err )) {
        response.code = structure[ '@code' ]

        const params = structure[ '@params' ]

        for (const param of params) {
          response.params.push( param.name )

          if (!param.value) response.values.push( 'null' )
          else if (param.value <= Number.MAX_SAFE_INTEGER && /^\d+$/.test( param.value ))
            response.values.push( param.value )
          else response.values.push( `\`${param.value.replace(/`/g, `\\\``)}\`` )
        }
      }
    } else { // help builder
      let { path } = commandData
      let help = ''

      if (path === prefix) help += ''
        + `**[${lang.help_optional}]**: abc**?**\n`
        + `**[${lang.help_rest}]**: ...abc\n`
        + `**[${lang.help_scope}]** ...`

      if (path !== prefix || prefixSpace) path += ' '

      for (const name in structure) {
        const field = structure[ name ]

        if (name.charAt( 0 ) != '@' && (field[ '@roles' ].includes( 'Anyone' ) || rolesTest( field[ '@roles' ] ))) {
          help += `\n\n**${path}${name}**`

          if ('@code' in field) {
            help += ':'

            for (const param of field[ '@params' ] ) {
              if (/^\/\^\(\?:[\S ]+\)\{0,1}\//.test( param.mask )) help += `  ${param.name}**?**`
              else if ('/^[\\s\\S]+/' === param.mask) help += `  ...${param.name}`
              else if ('/^[\\s\\S]*/' === param.mask) help += `  ...${param.name}**?**`
              else help += `  ${param.name}`
            }
          } else help += ' ...'

          if ('@desc' in field) help += `\n   ${field[ '@desc' ].replace( /\n/g, '\n   ' )}`
        }
      }

      response.code = this.messenger
      response.params = [ 'title', 'description' ]
      response.values = [ `\`⚙ ${this.lang.help}:\``, `\`${help.replace(/`/g, `\\\``)}\`` ]
    }
  }

  /**
   * @param {CommandData} commandData
   */
  processErrors( commandData ) {
    const { response, path } = commandData
    const { type, value, paramMask } = commandData.err

    switch (type) {
      case 'noCommand':
        response.values = [
          `\`❌  ${this.lang.err_noCommand}\``,
          `\`👉  \\\`${this.prefix ? `${path} ` : path} ${value}\\\`\``
        ]
      break

      case 'badRole':
        response.values = [
          `\`❌  ${this.lang.err_badRole}\``,
          `\`👉  ${path}\``
        ]
      break

      case 'badParam':
        response.values = [
          `\`❌  ${this.lang.err_badParam}\``,
          `\`👉  ${value}\``
        ]
      break

      case 'noParam':
        response.values = [
          `\`❌  ${this.lang.err_noParam}\``,
          `\`👉  ${value} \\\`${`${paramMask}`.replace( /\\/g, '\\\\' )}\\\`\``
        ]
      break
    }

    response.params = [ 'title', 'description' ]
    response.code = this.messenger
  }

  /**
   * @param {any} structure
   */
  static build( structure={} ) {
    const command = {}

    for (const field in structure) {
      if (![ 'function', 'object' ].includes( typeof structure[ field ] )) continue

      if (typeof structure[ field ] === 'function') {
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
      functionCutter: /^(?<name>\S+) *\( *(?<params>[\s\S]*?) *\) *{ *(?<code>[\s\S]*)}$/,

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

  /**
   * @param {string} command
   * @param {any} params
   * @param {any} err
   */
  static paramChecker( command, params, err ) {
    for (const param of params) {
      if (!param.mask.test( command )) {
        err.paramMask = param.mask

        if (!command) {
          err.type = 'noParam'
          err.value = param.name
        } else {
          err.type = 'badParam'
          err.value = (command || '').split( ' ' )[0]  ||  ' 👈'
        }

        return false
      }

      param.value = param.mask.exec( command )[ 0 ] || null

      if (param.value) command = command.substr( param.value.length ).trimLeft()
    }

    return true
  }

  /**
   * @param {string} code
   * @param {any} $
   */
  static eval( code, $ ) {
    const m = $.message

    eval( code )
  }

  /**
   * @param {any} target
   * @param  {...any} objects
   */
  static cloneObjects( target, ...objects ) {
    return objects.reduce( (target, object) => {
      Object.keys( object ).forEach( key => {
        if (typeof object[ key ] === 'object') {
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

              if (what === 'commands') {
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
    },
    getConfigFile( r=`Owner`, p={ what:/c|commands|f|filters/ }, d=`Get file with commands or filters` ) {
      let configFileName = `${fs.realpathSync( '.' )}/guilds_config/${m.guild.id}-${/c|commands/.test( what ) ? 'commands' : 'filters'}`

      if (fs.existsSync( `${configFileName}.js` )) configFileName += '.js'
      else if (fs.existsSync( `${configFileName}.mjs` )) configFileName += '.mjs'
      else configFileName = ''

      m.channel.send( { files:[ configFileName ] } )
    }
  }
}