import formidable from "formidable"
import fs  from "fs"

import { getUserFromToken } from "./auth.js"

const RESPONSES = {
  ONLY_POST:      { status:405, message:`Only POST method operated` },
  ONLY_GET:       { status:405, message:`Only GET method operated` },
  NO_GAME:        { status:400, message:`Missing "game" file` },
  LOGGED_NEEDED:  { status:400, message:`Logged via Discord needed` },
  ONLY_ZIP:       { status:400, message:`Only .zip files operated` },

  SERVER_ERR:     { status:500, message:`Internal server error` },

  GAME_UPLOADED:  { status:200, message:`Game uploaded successfully` },
}


/**
 * @param {import("http").ServerResponse} res
 * @param {{ status:number message:string }} param1
 */
function end( res, { status, message }, success=(status < 300)  ) {
  const json = { [success ? `ok` : `error`]: message }

  return res.writeHead( status, message ).end( JSON.stringify( json ) )
}


/**
 * @param {import("http").ClientRequest} req
 * @param {import("http").ServerResponse} res
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

    end( res, RESPONSES.GAME_UPLOADED )
  } )
}


/**
 * @param {import("http").ClientRequest} req
 * @param {import("http").ServerResponse} res
 * @param {string[]} urlParts
 */
export function fetchGames( req, res ) {
  if (req.method.toLowerCase() != `get`) return end( res, RESPONSES.ONLY_GET )

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
 * @param {import("http").ClientRequest} req
 * @param {import("http").ServerResponse} res
 * @param {string[]} urlParts
 */
export function downloadGame( req, res, urlParts ) {
  if (req.method.toLowerCase() != `get`) return end( res, RESPONSES.ONLY_GET )

  const path = `./games/${urlParts[ 0 ]}/${urlParts[ 1 ]}`

  if (fs.existsSync( path )) res.end( fs.readFileSync( path ) )
  else end( res, RESPONSES.SERVER_ERR )
}