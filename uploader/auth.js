import fs from "fs"
import fetch from "node-fetch"
import config from "./private.js"

/** @typedef {import("http").IncomingMessage} ClientRequest */
/** @typedef {import("http").ServerResponse} ServerResponse */

/**
 * @typedef {object} User
 * @property {string} id
 * @property {string} username
 * @property {string} avatar
 * @property {string} discriminator
 * @property {string} locale
 * @property {number} public_flags
 * @property {string} flags
 * @property {string} mfa_enabled
 */

 /**
  * @typedef {object} ErrMsg
  * @property {string} message
  * @property {number} code
  */

/**
 * @typedef {object} Session
 * @property {string} token
 * @property {User} user
 * @property {number} lastActivity
 */

/** @typedef {ClientRequest} */

/** @type {Session[]} */
const sessions = []
const ONE_MINUTE = 1000 * 60

if (fs.existsSync( `./sessions.json` )) sessions.push( ...JSON.parse( fs.readFileSync( `./sessions.json`, `utf-8` ) ) )

setInterval( () => {
  sessions = sessions.filter( ({ lastActivity }) => Date.now() - ONE_MINUTE * 5 > lastActivity  )
}, ONE_MINUTE * 15 )

/** @param {ClientRequest} req */
export function getTokenFromRequest( req ) {
  const authentication = req.headers[ `authorization` ]

  return authentication ? authentication.match( /Bearer (.*)/ )[ 1 ] : null
}

/** @param {ClientRequest} req */
export function authorizeRequest( req ) {
  const token = getTokenFromRequest( req )

  if (!token) return false

  req.session = sessions.find( s => s.token === token )

  return true
}

/**
 * @param {ClientRequest} req
 * @param {ServerResponse} res
 * @param {string[]} urlParts
 */
export function handleSessionFromToken( req, res, urlParts ) {
  if (req.method.toLowerCase() != `get`) return
  if (!urlParts.length) return

  const token = urlParts[ 0 ]
  const user = getUserFromToken( token )

  res.writeHead( 200, { "Content-Type":`text/json` } )

  if (user) res.end( JSON.stringify( user ) )
  else res.end( JSON.stringify( { message:`No session finded` } ) )
}

/**
 * @param {ClientRequest} req
 * @param {ServerResponse} res
 * @param {string[]} urlParts
 */
export function handleUrlQuery( req, res, urlParts ) {
  if (req.method.toLowerCase() != `get`) return
  if (!urlParts.length) return

  const reqLocation = req.headers.referer.match( /(?<origin>https?:\/\/(?<host>localhost|\d+\.\d+\.\d+\.\d+)(?::(?<port>\d+))?)/ )
  const accessCode = urlParts[ 0 ]
  const data = {
    client_id: config.clientId,
    client_secret: config.clientSecret,
    grant_type: `authorization_code`,
    redirect_uri: reqLocation.groups.origin,
    code: accessCode,
    scope: `identify`,
  }

  return fetch( `https://discord.com/api/oauth2/token`, {
    method: 'POST',
    body: new URLSearchParams( data ),
    headers: { "Content-Type":`application/x-www-form-urlencoded` },
  } )
    .then( res => res.json() )
    .then( info =>
      fetch( `https://discord.com/api/users/@me`, { headers: {
        authorization: `${info.token_type} ${info.access_token}`,
      } } ).catch( console.error )
    )
    .then( res => res.json() )
    .then( /** @param {User|ErrMsg} user */ user => {
      if (user.message) return user

      const token = Math.random().toString()
      const data = { token, user, lastActivity:Date.now() }

      sessions.push( data )

      fs.writeFileSync( `./sessions.json`, JSON.stringify( sessions ) )

      return data
     } )
    .then( JSON.stringify )
    .then( user => res.writeHead( 200, { "Content-Type":`text/json` } ).end( user ) )
    .catch( console.error )
}

/** @param {string} token */
export function getUserFromToken( token ) {
  return sessions.find( session => session.token == token )
}