const gamesList = document.querySelector( `.games` )

function getGameHtmlListItem( nickname, description, avatarUrl=null ) {
  const li  = document.createElement( `li` )
  const img = document.createElement( `img` )
  const div = document.createElement( `div` )
  const h3  = document.createElement( `h3` )
  const p   = document.createElement( `p` )

  p.innerHTML = description

  p.className = `tile-description`

  h3.textContent = nickname
  h3.className = `tile-title`

  if (avatarUrl) {
    img.src = avatarUrl
    img.className = `tile-icon`

    li.appendChild( img )
  }

  div.className = `tile-data`
  div.appendChild( h3 )
  div.appendChild( p )

  li.className = `tile`
  li.appendChild( div )

  return li
}

export default async function fetcher() {
  const games = await fetch( `/api/fetchGames` ).then( res => res.json() )
  const gamesItems = games.map( ({ userId, username, avatarUrl, games }) => games.map( gamename => {
    const a = `<a download href="/api/downloadGame/${userId}/${gamename}">${gamename}</a>`

    return getGameHtmlListItem( username, a, avatarUrl )
  } ) ).flat()

  gamesList.innerHTML = ``
  gamesItems.forEach( gameItem => gamesList.appendChild( gameItem ) )
}
