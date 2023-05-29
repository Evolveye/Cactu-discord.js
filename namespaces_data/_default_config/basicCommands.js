import { Module, Scope, Executor } from "../../lib/index.js"

export const config = { abc:1 }

export default new Module({
  commands: new Scope( {}, {
    ping: new Executor( {}, () => {
      console.log( `ping pong command` )
    } ),
  } ),
})
