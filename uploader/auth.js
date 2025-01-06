import fs from "fs"
import fetch from "node-fetch"
import config from "./private.js"
import getReqOrigin from "./getReqOrigin.js"

/** @typedef {import("http").IncomingMessage} ClientRequest */
/** @typedef {import("http").ServerResponse} ServerResponse */

/**
 * @typedef {object} DiscordUser
 * @property {string} id
 * @property {string} username
 * @property {string} global_name
 * @property {string} avatar
 * @property {string} discriminator
 * @property {number} public_flags
 * @property {string} flags
 * @property {number} accent_color
 */

/**
 * @typedef {object} User
 * @property {string} id
 * @property {string} displayName
 * @property {string} avatarHref
 * @property {string} accentColor
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
let sessions = []
const ONE_MINUTE = 1000 * 60

if (fs.existsSync( `./sessions.json` )) sessions.push( ...JSON.parse( fs.readFileSync( `./sessions.json`, `utf-8` ) ) )

setInterval( () => {
  sessions = sessions.filter( ({ lastActivity }) => Date.now() - ONE_MINUTE * 5 > lastActivity )
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

  res.writeHead( 200, { "Content-Type":`text/json` } )

  const token = urlParts[ 0 ]
  const session = getUserFromToken( token )
  if (!session) return res.end( JSON.stringify({ message:`No session found` }) )

  console.log( `Retrieving user from session token -> ${session.user.displayName}` )
  res.end( JSON.stringify( session ) )
}

/**
 * @param {ClientRequest} req
 * @param {ServerResponse} res
 * @param {string[]} urlParts
 */
export function handleUrlQuery( req, res, urlParts ) {
  if (req.method.toLowerCase() != `get`) return
  if (!urlParts.length) return

  const reqOrigin = getReqOrigin( req )
  if (!reqOrigin) return

  const accessCode = urlParts[ 0 ]
  const data = {
    grant_type: `authorization_code`,
    redirect_uri: reqOrigin,
    code: accessCode,
    scope: `identify`,
  }

  return fetch( `https://discord.com/api/v10/oauth2/token`, {
    method: `POST`,
    body: new URLSearchParams( data ),
    headers: {
      "Content-Type": `application/x-www-form-urlencoded`,
      Authorization: `Basic ${btoa( `${config.clientId}:${config.clientSecret}` )}`,
    },
  } )
    .then( res => res.json() )
    .then( info => {
      // console.log({ info })

      return fetch( `https://discord.com/api/v10/users/@me`, { headers: {
        authorization: `${info.token_type} ${info.access_token}`,
      } } ).catch( console.error )
    } )
    .then( res => res.json() )
    .then( user => {
      // console.log({ user })
      if (user.message) return user

      const lastActivity = Date.now()
      const token = Math.random().toString().slice( 2 ) + lastActivity
      const data = { token, lastActivity, user:getSessionUserFromDiscordUser( user ) }

      sessions.push( data )

      console.log( `Logged -> ${user.username}` )

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

/** @param {string} id */
export function loadDiscordUser( id ) {
  return fetch( `https://discord.com/api/v10/users/${id}`, { headers: {
    authorization: `Bot ${config.botToken}`,
  } } ).then( r => r.json() ).catch( console.error )
}

/** @param {string} id @param {string} avatarHash  */
export function getDiscordUserAvatarHref( id, avatarHash ) {
  return `https://discord.com/api/v10/users/${id}/${avatarHash}.png`
}

/** @param {DiscordUser} user */
export function getDiscordUserDisplayName( user ) {
  return user.global_name ?? user.username
}

/** @param {DiscordUser} user @returns {User} */
export function getSessionUserFromDiscordUser( user ) {
  return {
    id: user.id,
    displayName: getDiscordUserDisplayName( user ),
    avatarHref: getDiscordUserAvatarHref( user ),
    accentColor: `#` + user.accent_color.toString( 16 ).padStart( 6, `0` ),
  }
}
