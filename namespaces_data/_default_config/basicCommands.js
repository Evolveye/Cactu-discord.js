import { Module, Scope, DCExecutor } from "../../lib/index.js"

export default new Module({
  commands: new Scope( {}, {
    $: new Scope( {}, {
      tell: new DCExecutor( {
        params: [ { name:`message`, type:`message` } ],
      }, $ => {
        console.log( `Tell by bot`, { $ } )
      } ),
    } ),

    ping: new DCExecutor( {}, $ => {
      $.send( `pong` )
    } ),
  } ),
})
