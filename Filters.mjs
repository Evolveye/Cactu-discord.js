import fs from "fs"


export default class Filters {
  constructor( guildId ) {
    const funcCode  = func => func.toString().match(/^[\S ]+\([\w\W]*?\)[ ]*{([\w\W]*)}$/)[1].trim()

    this.data = { code:``, regExps:[] }

    let configFileName = `./guilds_config/${guildId}-filters.js`
    if (fs.existsSync( configFileName )) {
      let d = this.data

      for (let filter of eval( fs.readFileSync( configFileName, `utf8` ) )) {
        let conditions  = Object.keys( filter )
        d.regExps.push( conditions[0] )
        d.code += ``
          + `if (${conditions[0]}.test( message )) {`
          + `\n  ${funcCode( filter[conditions.shift()] )}` //.replace( /(`|\$)/g,'\\$1' )
          + `\n}`
  
        for (let condition of conditions) {
          d.regExps.push( condition )
          d.code += `\n`
            + `else if (${condition}.test( message )) {`
            + `\n  ${funcCode( filter[condition] )}`
            + `\n}`
        }
  
        d.code += `\n\n`
      }
    }
  }

  catch( message, variables ) {
    Filters.eval( `( function(){ ${this.data.code} }() )`, message, variables )
  }

  static eval( code, message, $ ) {
    eval( code )
  }
}