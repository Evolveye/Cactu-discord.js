import { Module, Scope, DCExecutor, Executor } from "../../lib/index.js"

export default new Module({
  commands: new Scope( {}, {
    nobody: new Executor( {
      perms: `_NOBODY`,
    }, () => {} ),

    $: new Scope( {
      perms: `_ADMIN`,
    }, {
      tell: new DCExecutor( {
        params: [ { name:`message`, type:`message` } ],
      }, $ => {
        $.send( `Tell me why?` )
      } ),
    } ),

    ping: new DCExecutor( {}, $ => {
      $.send( `pong` )
    } ),
  } ),
})
