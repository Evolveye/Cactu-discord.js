import fetch from "node-fetch"
import config from "./private.js"

/**
 * @param {import("url").UrlWithParsedQuery} urlObj
 */
export default function handleUrlQuery( urlObj ) {
  if (!urlObj.query.code) return

  const accessCode = urlObj.query.code
  const data = {
    client_id: config.clientId,
    client_secret: config.clientSecret,
    grant_type: `authorization_code`,
    redirect_uri: `http://localhost:80/`,
    code: accessCode,
    scope: `identify`,
  }

  return fetch( `https://discord.com/api/oauth2/token`, {
    method: 'POST',
    body: new URLSearchParams( data ),
    headers: { "Content-Type":`application/x-www-form-urlencoded` },
  } )
    .then( res => res.json() )
    .then( info => fetch( `https://discord.com/api/users/@me`, { headers: {
      authorization: `${info.token_type} ${info.access_token}`,
    } } ) )
    .then( res => res.json() )
    // .then( console.log )
}
