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
 * @typedef {object} AuthObj
 * @property {string} token Simple session token
 * @property {User} user
 */

const ui = {
  authLinkWrapper: document.querySelector( `.auth-link-wrapper` ),
  authLink: document.querySelector( `.auth-link` ),
  authUserWrapper: document.querySelector( `.auth-user-wrapper` ),
  authUserName: document.querySelector( `.auth-user-name` ),
}

const fragment = new URLSearchParams( location.search )
const token = localStorage.getItem( `token` )
const preAuthListeners = []

ui.authLink.href = `https://discord.com/oauth2/authorize`
  + `?client_id=379234773408677888`
  + `&redirect_uri=${encodeURIComponent( location.origin )}`
  + `&response_type=code`
  + `&scope=identify`

if (token) {
  fetch( `/api/discordFromToken/${token}` )
    .then( res => res.json() )
    .then( data => {
      if (data.message) {
        localStorage.removeItem( `token` )
        showAuthLink()
      } else showAuthUser( data.user )
    } )
} else if (fragment.has( `code` )) {
  fetch( `/api/discordAuth/${fragment.get( `code` )}` )
    .then( res => res.json() )
    .then( /** @param {AuthObj|ErrMsg} data */ data => {
      if (!data.message) return data

      showAuthLink()

      console.error( data )
    } )
    .then( /** @param {AuthObj} data */ data => {
      if (!data) return

      const { user, token } = data

      showAuthUser( user )

      localStorage.setItem( `token`, token )

      preAuthListeners.splice( 0 ).forEach( handler => handler() )
    } )
} else showAuthLink()

export const getToken = () => localStorage.getItem( `token` )
export const getAuthHeader = () => ({ Authorization:`Bearer ${getToken()}` })

export const onAuthorize = handler => {
  if (getToken()) handler()
  else preAuthListeners.push( handler )
}

function showAuthLink() {
  ui.authLinkWrapper.style.display = `block`
}
/** @param {User} user  */
function showAuthUser( user ) {
  ui.authUserName.textContent = `${user.username}#${user.discriminator}`
  ui.authUserWrapper.style.display = `block`

  console.log( user )
}