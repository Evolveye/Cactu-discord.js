export default class Filters {
  constructor( arr=[] ) {
    const funcCode  = func => func.toString().match(/^[\S ]+\([\w\W]*?\)[ ]*{([\w\W]*)}$/)[1]
    this.filterCode = ``
    this.regExps = []

    for (let filter of arr) {
      let conditions  = Object.keys( filter )
      this.regExps.push( conditions[0] )
      this.filterCode += ``
        + `if (${conditions[0]}.test( message ))`
        + `  return \`${funcCode( filter[conditions.shift()] ).replace( /(`|\$)/g,'\\$1' )}\``

      for (let condition of conditions) {
        this.regExps.push( condition )
        this.filterCode += `\n`
          + `else if (${condition}.test( message ))`
          + `  return \`${funcCode( filter[condition] ).replace( /(`|\$)/g,'\\$1' )}\``
      }

      this.filterCode += `\n\n`
    }
  }

  catch( message ) {
    return eval( `( function(){ ${this.filterCode} }() )` )
  }
}