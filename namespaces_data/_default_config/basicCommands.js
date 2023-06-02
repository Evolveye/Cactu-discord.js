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
        shortDescription: `Say something by bot`,
        params: [ { name:`message`, type:`message` } ],
      }, $ => {
        $.send( `Tell me why?` )
      } ),

      eval: new DCExecutor( {
        shortDescription: `Evaluate JS code with executor context`,
        params: [ { name:`code`, type:`message` } ],
      }, $ => {
        $.send( `Evaluation!` )
      } ),
    } ),

    ping: new DCExecutor( {}, $ => {
      $.send( `pong` )
    } ),
  } ),
})
