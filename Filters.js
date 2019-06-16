import fs from "fs"

export default class Filters {
  constructor( guildId ) {
    this.data = { code:``, regExps:[] }
    let configFileName = `${fs.realpathSync( `.` )}/guilds_config/${guildId}-filters`

    if ( fs.existsSync( `${configFileName}.js` ) )
      configFileName += `.js`
    else if ( fs.existsSync( `${configFileName}.mjs` ) )
      configFileName += `.mjs`
    else
      configFileName = ``

    if ( fs.existsSync( configFileName ) )
      this.setFilters( eval( fs
        .readFileSync( configFileName, `utf8` )
        .match( /^.*?(\[[ \r\n]*{[\s\S]+}[ \r\n]*])$/s )[ 1 ]
      ) )
  }

  setFilters( array ) {
    this.data = { code:``, regExps:[] }

    const d = this.data
    const funcCode  = func => func
      .toString()
      .match( /^[\S ]+\([\w\W]*?\)[ ]*{([\w\W]*)}$/ )[ 1 ]
      .trim()

    for ( const filter of array ) {
      const conditions  = Object.keys( filter )

      d.regExps.push( conditions[ 0 ] )
      d.code += ``
        + `if (${conditions[ 0 ]}.test( message )) {`
        + `\n  ${funcCode( filter[ conditions.shift() ] )}`
        + `\n}`

      for ( const condition of conditions ) {
        d.regExps.push( condition )
        d.code += `\n`
          + `else if (${condition}.test( message )) {`
          + `\n  ${funcCode( filter[ condition ] )}`
          + `\n}`
      }

      d.code += `\n\n`
    }
  }

  catch( message, variables ) {
    try {
      Filters.eval( `( function(){ ${this.data.code} }() )`, message, variables )
    }
    catch {
      variables.message.channel.send( `❌ Error!` )
    }
  }

  static eval( code, message, $ ) {
    eval( code )
  }
}