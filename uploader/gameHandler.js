import formidable from "formidable"
import fs  from "fs"

import { getUserFromToken } from "./auth.js"

/**
 * @param {import("http").ClientRequest} req
 * @param {import("http").ServerResponse} res
 * @param {string[]} urlParts
 */
export default function handlerGames( req, res, urlParts ) {
  if (req.method.toLowerCase() != `post`) return

  /** @type {formidable.IncomingForm} */
  const form = formidable({ multiplies:true })

  form.parse( req, (err, fields, files) => {
    const { path:tempPath, name } = files.game
    const raw = fs.readFileSync( tempPath )
    const { user } = getUserFromToken( fields.token )

    if (!fs.existsSync( `./games/${user.id}` )) fs.mkdirSync( `./games/${user.id}` )

    fs.readdirSync( `./games/${user.id}` ).forEach( filename => fs.unlink( filename ) )
    fs.writeFileSync( `./games/${user.id}/${name}`, raw )

    console.log( { fields, files } )
  } )
}