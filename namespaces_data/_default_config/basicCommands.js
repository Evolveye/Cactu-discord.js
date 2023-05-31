import { Module, Scope, Executor } from "../../lib/index.js"

export default new Module({
  commands: new Scope( {}, {
    $: new Scope( {}, {
      tell: new Executor( {
        params: [ { name:`message`, type:`message` } ],
      }, $ => {
        console.log( `Tell by bot`, { $ } )
      } ),
    } ),

    ping: new Executor( {}, $ => {
      $.send( `pong` )
    } ),
  } ),
})
