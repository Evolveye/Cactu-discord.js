import http from "http"
import fs from "fs"

const staticPath = `./public/`

http.createServer( (req, res) => {
  const urlPath = req.url.split( `?` )[ 0 ]
  const staticFilePath = `${staticPath}${urlPath == "/" ? `index.html` : urlPath}`

  if (!fs.existsSync( staticFilePath )) return res
    .writeHead( 404, { "Content-Type":`text/json` } )
    .end( JSON.stringify( { error:`Wrong route. Content didn't find.` } ) )

  const pageContent = fs.readFileSync( staticFilePath )

  res.writeHead( 200, { "Content-Type":getMime( staticFilePath ) } )
    .end( pageContent )
} ).listen( 80, () => console.log( `started` ) )

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