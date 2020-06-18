import https from 'https'
import fs from 'fs'

class CommandData {
  constructor( command, author, partedCommand, structure ) {
    this.authorAvatarUrl = author.avatarURL
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
        embed: { title, description, author, fields,
          color: 0x18d818,
          footer: { text:footerText, icon_url:authorAvatarUrl },
          timestamp: new Date(),
        }
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

    const data = new CommandData( command, variables.message.author, this.partCommand( command ), this.structure )
    const err = data.err

    if (!this.checkPrefix( data )) return

    if (!err.type) this.checkAccesToStructure( data, rolesTest )
    if (!err.type) this.buildResponse( data, rolesTest )
    if (err.type) this.processErrors( data )

    try {
      const { params, values, code } = data.response

      Commands.eval( `( (${params.join( ',' )}) => {${code}} )(${values.join( ',' )})`, variables )

      const guildName = variables.message.guild.name
      const loggedGuildName = guildName.length > 30 ? `${guildName.slice( 0, 27 )}...` : guildName.slice( 0, 30 )

      this.logger( loggedGuildName, `::`, `Commands`, `:`, variables.message.member.displayName, `:`, command )
    } catch (error) {
      const errorMessage = typeof error === 'string' ? error : this.lang.err_invalidCommand

      variables.sendStatus( `${errorMessage} \n ${error}`, 'error' )
    }
  }

  /**
   * @param {any} langPack
   */
  setLang( langPack ) {
    this.lang = {
      err_invalidCommand: langPack.err_invalidCommand || "That command have invalid code!",
      err_noCommand:      langPack.err_noCommand      || "Command doesn't exists",
      err_badParam:       langPack.err_badParam       || "Not valid parameter",
      err_noParam:        langPack.err_noParam        || "You didn't write required parameters",
      err_badRole:        langPack.err_badRole        || "You don't have permissions to use that!",
      help:               langPack.help               || "Help for a syntax of the specified command",
      help_showMasks:     langPack.help_showMasks     || "Send **!!** as first parameter of command to show description and params syntax",
      help_params:        langPack.help_params        || "The X**?** means optional parameter and the **...**X means any string",
      help_checkMasks:    langPack.help_checkMasks    || "If you don't know what is going on, you can ask somebody from server stuff, or you can check \"masks\" on",
      footer_yourCmds:    langPack.footer_yourCmds    || "these are your personalized commands after sending:",
      footer_cmdsInfo:    langPack.footer_cmdsInfo    || "Commands information",
      $_loadCommands:     langPack.$_loadCommands     || "Load the commands from attachment",
      // $_loadFilters:   langPack.$_loadFilters      || "Load the filters from attachment",
      $_loadSucces:       langPack.$_loadSucces       || "✅ File has been loaded",
      $_loadFail:         langPack.$_loadFail         || "Wrong file data!",
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

      if (structure[ '@code' ]) {
        if (!rolesTest( structure[ '@roles' ] )) this.setError( err, 'badRole' )
        break
      }
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
    const { command, structure, err, response, path } = commandData
    const { prefix, prefixSpace, lang } = this

    if ('@code' in structure) {
      const params = structure[ '@params' ]

      if (command && command.match( /[^ ]+/ )[ 0 ] == `!!`) {
        console.log( 123 )
        let description = structure[ '@desc' ]

        description += `\n\\\`\\\`\\\``

        for (const param of structure[ '@params' ] ) {
          if (/^\/\^\(\?:[\S ]+\)\{0,1}\//.test( param.mask )) description += `${param.name}?`.padStart( 15, ` ` ) + ` => ${param.mask}\n`
          else if ('/^[\\s\\S]+/' === param.mask) description += `...${param.name}`.padStart( 15, ` ` ) + ` => ${param.mask}\n`
          else if ('/^[\\s\\S]*/' === param.mask) description += `...${param.name}?`.padStart( 15, ` ` ) + ` => ${param.mask}\n`
          else description += `${param.name}`.padStart( 15, ` ` ) + ` => ${param.mask}\n`
        }

        description += `\\\`\\\`\\\``
        description += `\n${lang.help_checkMasks} https://regexr.com/`

        response.code = this.messenger
        response.params = [ `title`, `description`, `author`, `fields`, `authorAvatarUrl`, `footerText` ]
        response.values = [
          `\`⚙ ${lang.help}: ${path}\``,
          `\`${description}\``,
          `"undefined"`,
          `[]`,
          `null`,
          `\`${lang.footer_cmdsInfo} ${path}\``
        ]
      } else if (Commands.paramChecker( command, structure[ '@params' ], err )) {
        response.code = structure[ '@code' ]

        for (const param of params) {
          response.params.push( param.name )

          if (!param.value) response.values.push( 'null' )
          else if (param.value <= Number.MAX_SAFE_INTEGER && /^\d+$/.test( param.value ))
            response.values.push( param.value )
          else response.values.push( `\`${param.value.replace(/`/g, `\\\``)}\`` )
        }
      }
    } else { // help builder
      const fieldsSections = { scopes:[], commands:[] }
      const pathWithSpace = path + (path !== prefix || prefixSpace ? ` ` : ``)
      let help = ``

      if (path === prefix) help += `${lang.help_showMasks}\n${lang.help_params}`

      for (const fragment in structure) {
        const field = structure[ fragment ]

        if (fragment.charAt( 0 ) != '@' && (field[ '@roles' ].includes( 'Anyone' ) || rolesTest( field[ '@roles' ] ))) {
          let name = `**${pathWithSpace}${fragment}**`
          let section = `scopes`
          let value = `- - -`

          if ('@code' in field) {
            for (const param of field[ '@params' ] ) {
              if (/^\/\^\(\?:[\S ]+\)\{0,1}\//.test( param.mask )) name += `   ${param.name}**?**`
              else if ('/^[\\s\\S]+/' === param.mask) name += `   ...${param.name}`
              else if ('/^[\\s\\S]*/' === param.mask) name += `   ...${param.name}**?**`
              else name += `   ${param.name}`
            }

            section = `commands`
          } else name += `...`

          if ('@desc' in field) value = `${field[ '@desc' ].replace( /\n/g, '\n' )}`

          fieldsSections[ section ].push( { name, value, inline:(section == `scopes`) } )
        }
      }

      let fields = [ ...fieldsSections.commands ]

      if (fieldsSections.scopes.length) {
        fields = [ ...fieldsSections.scopes, { name:'\u200B', value:'\u200B' }, ...fieldsSections.commands ]
      } else fields = [ ...fieldsSections.commands ]

      response.code = this.messenger
      response.params = [ `title`, `description`, `author`, `fields`, `authorAvatarUrl`, `footerText` ]
      response.values = [
        `\`⚙ ${lang.help}:\``,
        `\`${help.replace(/`/g, `\\\``)}\``,
        `${JSON.stringify( {
          name: 'CodeCactu',
          icon_url: 'https://avatars2.githubusercontent.com/u/47976703?s=200&v=4'
        } )}`,
        `${JSON.stringify( fields )}`,
        `\`${commandData.authorAvatarUrl}\``,
        `\`${lang.footer_yourCmds} ${pathWithSpace}\``
      ]
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
          `\`> ${this.prefix ? `${path} ` : path} ${value}\``,
          `\`undefined\``,
          `[]`,
          `null`,
          `\`${this.lang.footer_cmdsInfo}\``
        ]
      break

      case 'badRole':
        response.values = [
          `\`❌  ${this.lang.err_badRole}\``,
          `\`>  ${path}\``,
          `\`undefined\``,
          `[]`,
          `null`,
          `\`${this.lang.footer_cmdsInfo}\``
        ]
      break

      case 'badParam':
        response.values = [
          `\`❌  ${this.lang.err_badParam}\``,
          `\`>  ${value}\``,
          `\`undefined\``,
          `[]`,
          `null`,
          `\`${this.lang.footer_cmdsInfo}\``
        ]
      break

      case 'noParam':
        response.values = [
          `\`❌  ${this.lang.err_noParam}\``,
          `\`>  ${value} \\\`${`${paramMask}`.replace( /\\/g, '\\\\' )}\\\`\``,
          `\`undefined\``,
          `[]`,
          `null`,
          `\`${this.lang.footer_cmdsInfo}\``
        ]
      break
    }

    response.code = this.messenger
    response.params = [ `title`, `description`, `author`, `fields`, `authorAvatarUrl`, `footerText` ]
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

            const { guildData } = $
            const cmdsInstance = guildData.commands

            let object = fs.readFileSync( fileName, 'utf8' )

            try {
              if (!reg.test( object )) throw ''

              object = eval( object.match( reg )[ 1 ] )

              if (what === 'commands') {

                cmdsInstance.structure = Commands.build( Commands.cloneObjects( object.structure, Commands.predefinedCommands ) )
                cmdsInstance.setLang( object.myLang )

                Object.keys( object )
                  .filter( key => key.startsWith( 'on' ) )
                  .forEach( key => cmdsInstance.events[ key.slice( 2 ) ] = object[ key ] )
              } else guildData.filters.setFilters( object )

              $.sendStatus( cmdsInstance.lang.$_loadSucces )
            } catch (err) {
              $.sendStatus( `${cmdsInstance.lang.$_loadFail}\n\n${err}`, 'error' )
              fs.unlink( fileName, () => {} )
            }
          } )
        } )
      }
    },
    botOperator( r='Owner', p={ roleName:'???' }, d='Set the role which will have owner permissions for bot' ) {
      if (!roleName) return $.bot.botOperatorId = null

      const role = $.message.guild.roles.find( r => r.name === role )

      if (role) {
        $.bot.botOperatorId = role.id
        $.sendStatus( 'Bot operator has been setted successfully' )
      } else throw "That role doesn't exists"
    },
    getConfigFile( r=`Owner`, p={ what:/c|commands|f|filters/ }, d=`Get file with commands or filters` ) {
      let configFileName = `${fs.realpathSync( '.' )}/guilds_config/${m.guild.id}-${/c|commands/.test( what ) ? 'commands' : 'filters'}`

      if (fs.existsSync( `${configFileName}.js` )) configFileName += '.js'
      else if (fs.existsSync( `${configFileName}.mjs` )) configFileName += '.mjs'
      else throw "That guild doesn't have the config file"

      m.channel.send( { files:[ configFileName ] } )
    },
    upload( r='Owner', d='Upload attached file' ) {
      const attachment = $.message.attachments.first() || {}
      const guildId = $.message.guild.id

      if (!attachment.url) throw `No attached file`

      const fileName = `${fs.realpathSync( '.' )}/guilds_config/${guildId}-${fileName}`
      const file = fs.createWriteStream( fileName )

      https.get( attachment.url, res => {
        res.pipe( file ).on( 'finish', () => {
          file.close()

          $.sendStatus( `Done` )
        } )
      } )
    },
  }
}