import fs from "fs"
import { Worker, isMainThread, parentPort } from "worker_threads"

const __DIRNAME = import.meta.url.match( /(.*)\// )[ 1 ].slice( 8 )
const commands = new Map()

export default class CommandsWorker {
  #listeners = new Map()
  /** @type {Worker} */
  worker = null

  constructor() {
    this.worker = isMainThread
      ? new Worker( `${__DIRNAME}/CommandsWorker.js` )
      : parentPort

    this.worker.on( `message`, this.#onmessage )
  }

  #onmessage = ({ event, data }) => {
    if (this.#listeners.has( event )) this.#listeners.get( event )( data )
  }

  on( event, fn ) {
    this.#listeners.set( event, fn )
  }

  emit( event, data ) {
    this.worker.postMessage({ event, data })
  }
}

if (!isMainThread) {
  const worker = new CommandsWorker()

  worker.on( `set commands`, ({ guildId, config }) => commands.set( guildId, config ) )
  worker.on( `get commands`, () => worker.emit( `commands`, commands ) )
}
