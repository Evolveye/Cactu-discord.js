import fs from "fs"

export default class Filters {
  constructor( guildId ) {
    this.data = { code:``, regExps:[] }

    let configFileName = `${fs.realpathSync( `.` )}/guilds_config/${guildId}-filters.js`

    if ( fs.existsSync( configFileName ) )
      this.setFilters( eval( fs.readFileSync( configFileName, `utf8` ) ) )
  }

  setFilters( array ) {
    const funcCode  = func => func
      .toString()
      .match( /^[\S ]+\([\w\W]*?\)[ ]*{([\w\W]*)}$/ )[ 1 ]
      .trim()

    let d = this.data
    for ( let filter of array ) {
      let conditions  = Object.keys( filter )
      d.regExps.push( conditions[ 0 ] )
      d.code += ``
        + `if (${conditions[ 0 ]}.test( message )) {`
        + `\n  ${funcCode( filter[ conditions.shift() ] )}`
        + `\n}`

      for ( let condition of conditions ) {
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
    Filters.eval( `( function(){ ${this.data.code} }() )`, message, variables )
  }

  static eval( code, message, $ ) {
    eval( code )
  }
}