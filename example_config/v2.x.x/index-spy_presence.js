import CactuDiscordBot, { LoggerClass } from "cactu-discord.js"
import readline from "readline"

// *
// *
const token = `  ==  secret  ==  `
// *
// *

const input = readline.createInterface( process.stdin )
const cactuBot = new CactuDiscordBot( { token } )
const bot = new LoggerClass( [
  { align:'right', color:'fgMagenta', length:5 },
  { length:3 },
  { splitLen:90, splitFLLen:65 },
] )
const question = new LoggerClass( [
  { align:'right', color:'fgBlue', length:3 },
  { splitLen:90, splitFLLen:65 },
] )
const log = new LoggerClass( [
  { color:`fgMagenta`, length:20, align:'right' },
  { color:`fgBlue`, length:5 },
  { color:`fgMagenta`, length:8, align:'right' },
  { color:`fgBlue`, align:`center`, length:6 },
  { length:30 },
  { color:`fgBlue`, align:`center`, length:6 },
  { color:`fgWhite`, length:30 },
] )

cactuBot.client.on( `ready`, () => setTimeout( main, 1000 * 4 ) )

function getDate() {
  const date = new Date()
  const h = `${date.getHours()}`.padStart( 2, `0`)
  const m = `${date.getMinutes()}`.padStart( 2, `0`)
  const s = `${date.getSeconds()}`.padStart( 2, `0`)

  return `${h}:${m}:${s}`
}
function readLine() {
  return new Promise( res => {
    input.resume()
    input.question( ``, value => {
      input.pause()
      res( value )
     } )
  } )
}
async function main() {
  const auto = (process.argv[ 2 ] || ``).toLowerCase() === `auto`
  const ids = process.argv.slice( 2 ).filter( id => /\d{18}/.test( id ) )

  if (!auto) {
    let id = `temp value`

    bot( `Bot`, `:`, `Paste ID of user to spy` )
    bot( `Bot`, `:`, `Wrong ID do nothing wrong` )
    bot( `Bot`, `:`, `Empty ID string will close IDs input` )
    console.log()

    while (id != ``) {
      question( `=> `, `Type Discord user ID, or send empty line` )
      process.stdout.write( ` > ` )
      id = await readLine()

      if (/\d{18}/.test( id )) {
        console.log()
        question( `   ADDED`, `` )
        console.log()

        ids.push( id )
      }
    }

    console.log()
  }

  const lastTimes = {}
  cactuBot.client.on( `presenceUpdate`, (member, { presence }) => {
    const { id } = member

    if (ids.length > 0 && !ids.includes( id )) return
    if (id in lastTimes && Date.now() - lastTimes[ id ] < 500) return

    lastTimes[ id ] = Date.now()

    const game1 = member.presence.game && member.presence.game.name
    const game2 = presence.game && presence.game.name

    const string1 = `${member.presence.status} ${game1}`
    const string2 = `${presence.status} ${game2}`

    if (string1 != string2) log( member.displayName, ` ::: `, getDate(), ` ::: `, string1, `->`, string2 )
  } )
}