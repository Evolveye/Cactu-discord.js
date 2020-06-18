import fs from 'fs'

export default class Filters {
  constructor( logger, guildId ) {
    this.logger = logger
    this.data = { code:'', regExps:[] }
    let configFileName = `${fs.realpathSync( '.' )}/guilds_config/${guildId}-filters`

    if (fs.existsSync( `${configFileName}.js` )) configFileName += '.js'
    else if (fs.existsSync( `${configFileName}.mjs` )) configFileName += '.mjs'
    else configFileName = ''

    if (fs.existsSync( configFileName )) this.setFilters( eval( fs
      .readFileSync( configFileName, `utf8` )
      .match( /^.*?(\[[ \r\n]*{[\s\S]+}[ \r\n]*])$/s )[ 1 ]
    ) )
  }

  setFilters( array ) {
    this.data = { code:'let matched = false \n\n', regExps:[] }

    const d = this.data
    const funcCode  = func => '    matched = true\n\n    ' + func
      .toString()
      .match( /^[\S ]+\([\w\W]*?\)[ ]*{([\w\W]*)}$/ )[ 1 ]
      .trim()

    for (const filter of array) {
      const conditions  = Object.keys( filter )

      d.regExps.push( conditions[ 0 ] )
      d.code += ''
        + `\n if (${conditions[ 0 ]}.test( m )) {`
        + `\n   ${funcCode( filter[ conditions.shift() ] )}`
        + '\n }'

      for (const condition of conditions) {
        d.regExps.push( condition )
        d.code += '\n'
          + `\n else if (${condition}.test( m )) {`
          + `\n   ${funcCode( filter[ condition ] )}`
          + '\n }'
      }

      d.code += '\n\n'
    }

    d.code += ''
      + '\n if (matched) throw ""'
  }

  catch( content, variables ) {
    try {
      Filters.eval( `( function(){ ${this.data.code} }() )`, variables )
    } catch (error) {
      if (typeof error === 'string') {
        const guildName = variables.message.guild.name
        const loggedGuildName = guildName.length > 30 ? `${guildName.slice( 0, 27 )}...` : guildName.slice( 0, 30 )

        this.logger( loggedGuildName, `::`, `Filters`, `:`, variables.message.member.displayName, `:`, content )
        if (error != ``) variables.sendStatus( error, 'error' )
      } else variables.sendStatus( 'Filters error!', 'error' )
    }
  }

  static eval( code, $ ) {
    const m = $.message
    eval( code )
  }
}