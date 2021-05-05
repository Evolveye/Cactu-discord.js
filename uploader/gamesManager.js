import formidable from "formidable"
import fs  from "fs"

import { getUserFromToken } from "./auth.js"

/**
 * @param {import("http").ClientRequest} req
 * @param {import("http").ServerResponse} res
 * @param {string[]} urlParts
 */
export function handleGame( req ) {
  if (req.method.toLowerCase() != `post`) return

  /** @type {formidable.IncomingForm} */
  const form = formidable({ multiplies:true })

  form.parse( req, (err, fields, files) => {
    const { path:tempPath, name:filename } = files.game
    const raw = fs.readFileSync( tempPath )
    const { user } = getUserFromToken( fields.token )

    if (!fs.existsSync( `./games/${user.id}` )) fs.mkdirSync( `./games/${user.id}` )

    fs.readdirSync( `./games/${user.id}` ).forEach( filename => fs.unlink( filename ) )
    fs.writeFileSync( `./games/${user.id}/${filename}`, raw )
    fs.writeFileSync( `./games/${user.id}/meta.json`, JSON.stringify( user ) )
  } )
}


/**
 * @param {import("http").ClientRequest} req
 * @param {import("http").ServerResponse} res
 * @param {string[]} urlParts
 */
export function fetchGames( req, res ) {
  if (req.method.toLowerCase() != `get`) return

  const usersWithGames = fs.readdirSync( `./games/` ).map( dirname => {
    const meta = JSON.parse( fs.readFileSync( `./games/${dirname}/meta.json`, `utf-8` ) )
    const games = fs.readdirSync( `./games/${dirname}` ).filter( filename => /\w+\.zip$/.test( filename ) )

    return {
      username: meta.username,
      avatarUrl: `https://cdn.discordapp.com/avatars/${meta.id}/${meta.avatar}.png`,
      games,
    }
  } )

  res.end( JSON.stringify( usersWithGames ) )
}