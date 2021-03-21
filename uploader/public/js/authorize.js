const ui = {
  authLinkWrapper: document.querySelector( `.auth-link-wrapper` ),
  authLink: document.querySelector( `.auth-link` ),
  authUserWrapper: document.querySelector( `.auth-user-wrapper` ),
  authUserName: document.querySelector( `.auth-user-name` ),
}

const fragment = new URLSearchParams( location.hash.slice( 1 ) )

if (fragment.has( `access_token` )) {
  const accessToken = fragment.get( `access_token` )
  const tokenType = fragment.get( `token_type` )

  fetch( `https://discord.com/api/users/@me`, { headers: {
    authorization: `${tokenType} ${accessToken}`
  } } )
    .then( res => res.json() )
    .then( response => {
      const { username, discriminator } = response;
      ui.authUserName.innerText = `${username}#${discriminator}`;
    })
    .catch( console.error );
} else ui.authLinkWrapper.style.display = `block`
