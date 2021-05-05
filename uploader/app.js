import http from "http"
import fs from "fs"
import url from "url"

import { handleUrlQuery, handleSessionFromToken } from "./auth.js"
import { handleGame, fetchGames, downloadGame } from "./gamesManager.js"

const staticPath = `./public/`

http.createServer( async (req, res) => {
  const urlObj = url.parse( req.url, true )

  if (urlObj.pathname.startsWith( `/api/` )) {
    const pathParts = urlObj.pathname.split( `/` ).filter( Boolean )
    const trigger = pathParts[ 1 ]
    const params = pathParts.slice( 2 )

    switch (trigger) {
      case `discordAuth`: return handleUrlQuery( req, res, params )
      case `discordFromToken`: return handleSessionFromToken( req, res, params )
      case `sendGame`: return handleGame( req, res, params )
      case `fetchGames`: return fetchGames( req, res, params )
      case `downloadGame`: return downloadGame( req, res, params )
      default: return send404( res, `This API field not exists` )
    }
  }

  const staticFilePath = `${staticPath}${urlObj.pathname == "/" ? `index.html` : urlObj.pathname}`

  if (!fs.existsSync( staticFilePath )) return send404( res )

  const pageContent = fs.readFileSync( staticFilePath )

  res.writeHead( 200, { "Content-Type":getMime( staticFilePath ) } )
    .end( pageContent )
} ).listen( 3000, () => console.log( `started` ) )

/**
 * @param {string} path
 */
function getMime( path ) {
  const extension = /.*\.(\w+)/.exec( path )[ 1 ]

  switch (extension) {
    case `html`: return `text/html`
    case `css`: return `text/css`
    case `js`: return `text/javascript`
    case `json`: return `text/json`

    default: return `text/plain`
  }
}

/**
 * @param {http.ServerResponse} res
 */
function send404( res, reason=`Wrong route. Content didn't find.` ) {
  res
    .writeHead( 404, { "Content-Type":`text/json` } )
    .end( JSON.stringify( { error:reason } ) )
}