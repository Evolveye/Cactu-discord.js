import formidable from "formidable"
import fs  from "fs"

import { authorizeRequest, getUserFromToken } from "./auth.js"

/** @typedef {import("http").IncomingMessage} ClientRequest */
/** @typedef {import("http").ServerResponse} ServerResponse */

const RESPONSES = {
  NOT_AUTH:       { status:401, message:`Unauthorized route` },
  ONLY_POST:      { status:405, message:`Only POST method operated` },
  ONLY_GET:       { status:405, message:`Only GET method operated` },
  NO_GAME:        { status:400, message:`Missing "game" file` },
  LOGGED_NEEDED:  { status:400, message:`Logged via Discord needed` },
  ONLY_ZIP:       { status:400, message:`Only .zip files operated` },
  WRONG_ANSWER:   { status:400, message:`Wrong form data` },

  SERVER_ERR:     { status:500, message:`Internal server error` },
  SUCCESS:        { status:200, message:`Operation success` },

  GAME_UPLOADED:  { status:200, message:`Game uploaded successfully` },
}


const formFields = [
  { categoryName:`subject`,     scale:[ 0, 1, 2 ] },        // Zgodność z tematem
  { categoryName:`impressions`, scale:[ 0, 1, 2, 3, 4 ] },  // Ogólne wrażenie, wywołana ciekawość, chęć zobaczenia kontynuacji, zaskoczenie
  { categoryName:`realisation`, scale:[ 0, 1, 2, 3, 4 ] },  // Spójność produktu, dobrze dobrane wizualia
  { categoryName:`readability`, scale:[ 0, 1, 2 ] },        // Czytelność i jasność zasad. Czy wiadomo co robić (jeśli błądzisz, czy wiesz o tym ze czegos szukasz)
]


/**
 * @param {ServerResponse} res
 * @param {{ status:number message:string }} param1
 */
function end( res, { status, message }, success=(status < 300)  ) {
  const json = { [success ? `ok` : `error`]: message }

  return res.writeHead( status, message ).end( JSON.stringify( json ) )
}


/**
 * @param {ClientRequest} req
 * @param {ServerResponse} res
 * @param {string[]} urlParts
 */
export function handleGame( req, res ) {
  if (req.method.toLowerCase() != `post`) return end( res, RESPONSES.ONLY_POST )

  /** @type {formidable.IncomingForm} */
  const form = formidable({ multiplies:true })

  form.parse( req, (err, fields, files) => {
    if (!files.game) return end( res, RESPONSES.NO_GAME )

    const { path:tempPath, name:filename } = files.game
    const raw = fs.readFileSync( tempPath )
    const session = getUserFromToken( fields.token )

    if (!session) return end( res, RESPONSES.LOGGED_NEEDED )
    if (!/\.zip$/.test( filename )) return end( res, RESPONSES.ONLY_ZIP )

    const { user } = session
    const userPath = `./games/${user.id}`

    if (!fs.existsSync( userPath )) fs.mkdirSync( userPath )

    fs.readdirSync( userPath ).forEach( filename => fs.unlinkSync( `${userPath}/${filename}` ) )
    fs.writeFileSync( `${userPath}/${filename}`, raw )
    fs.writeFileSync( `${userPath}/meta.json`, JSON.stringify( user ) )

    console.log( `Uploading -> ${user.username} :: ${filename}` )

    end( res, RESPONSES.GAME_UPLOADED )
  } )
}


/**
 * @param {ClientRequest} req
 * @param {ServerResponse} res
 * @param {string[]} urlParts
 */
export function fetchGames( req, res ) {
  if (req.method.toLowerCase() != `get`) return end( res, RESPONSES.ONLY_GET )

  if (!fs.existsSync( `./games/` )) fs.mkdirSync( `./games/` )

  const usersWithGames = fs.readdirSync( `./games/` ).map( dirname => {
    const meta = JSON.parse( fs.readFileSync( `./games/${dirname}/meta.json`, `utf-8` ) )
    const games = fs.readdirSync( `./games/${dirname}` ).filter( filename => /\.zip$/.test( filename ) )

    return {
      userId: meta.id,
      username: meta.username,
      avatarUrl: `https://cdn.discordapp.com/avatars/${meta.id}/${meta.avatar}.png`,
      games,
    }
  } )

  res.end( JSON.stringify( usersWithGames ) )
}


/**
 * @param {ClientRequest} req
 * @param {ServerResponse} res
 * @param {string[]} urlParts
 */
export function downloadGame( req, res, urlParts ) {
  if (req.method.toLowerCase() != `get`) return end( res, RESPONSES.ONLY_GET )

  const path = `./games/${urlParts[ 0 ]}/${urlParts[ 1 ]}`

  if (fs.existsSync( path )) res.end( fs.readFileSync( path ) )
  else end( res, RESPONSES.SERVER_ERR )
}


/**
 * @param {ClientRequest} req
 * @param {ServerResponse} res
 * @param {string[]} urlParts
 */
export function voteOnGame( req, res, urlParts ) {
  if (req.method.toLowerCase() != `post`) return end( res, RESPONSES.ONLY_POST )

  authorizeRequest( req )

  if (!req.session) return end( res, RESPONSES.NOT_AUTH )

  req.on(`data`, formDataJson => {
    const formPosibleAnserws = formFields.reduce(
      (obj, { categoryName, scale }) => ({ ...obj, [categoryName]:scale }), {}
    )

    const formData = JSON.parse( formDataJson )
    const path = `./games/${req.session.user.id}/voting.json`

    for (const [ key, scale ] of Object.entries( formPosibleAnserws )) {
      if (key in formData && scale.includes( Number( formData[ key ] ) )) formPosibleAnserws[ key ] = Number( formData[ key ] )
      else return end( res, RESPONSES.WRONG_ANSWER )
    }

    if (!fs.existsSync( path )) fs.writeFileSync( path, `{}` )

    const votes = JSON.parse( fs.readFileSync( path, `utf-8` ) )

    votes[ urlParts[ 0 ] ] = formPosibleAnserws

    console.log( `Voting -> ${req.session.user.username} :: ${JSON.stringify( votes )}` )

    fs.writeFileSync( path, JSON.stringify( votes ) )

    return end( res, RESPONSES.SUCCESS )
  } )
}


/**
 * @param {ClientRequest} req
 * @param {ServerResponse} res
 * @param {string[]} urlParts
 */
export function getMyVotes( req, res, urlParts ) {
  if (req.method.toLowerCase() != `get`) return end( res, RESPONSES.ONLY_POST )

  authorizeRequest( req )

  if (!req.session) return end( res, RESPONSES.NOT_AUTH )

  const userFolder = `./games/${req.session.user.id}`
  const path = `${userFolder}/voting.json`

  if (!fs.existsSync( path )) {
    if (!fs.existsSync( userFolder )) fs.mkdirSync( userFolder )

    fs.writeFileSync( path, `{}` )
  }

  const votes = fs.readFileSync( path, `utf-8` )

  res.end( votes )
}