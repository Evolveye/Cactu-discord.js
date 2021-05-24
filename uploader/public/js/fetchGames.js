import { getAuthHeader, getToken } from "./authorize.js"

const gamesList = document.querySelector( `.games` )


function getGameHtmlTile( nickname, description, avatarUrl=null ) {
  const tile            = document.createElement( `div` )
  const tileIcon        = document.createElement( `img` )
  const tileData        = document.createElement( `div` )
  const tileTitle       = document.createElement( `h3` )
  const tileDescription = document.createElement( `p` )

  tileDescription.innerHTML = description

  tileDescription.className = `tile-description`

  tileTitle.textContent = nickname
  tileTitle.className = `tile-title`

  if (avatarUrl) {
    tileIcon.src = avatarUrl
    tileIcon.className = `tile-icon`

    tile.appendChild( tileIcon )
  }

  tileData.className = `tile-data`
  tileData.appendChild( tileTitle )
  tileData.appendChild( tileDescription )

  tile.className = `tile`
  tile.appendChild( tileData )

  return tile
}


function getGameHtmlForm( userId ) {
  const form            = document.createElement( `form` )
  const fieldsets       = document.createElement( `div` )
  const scaleWrapper    = document.createElement( `div` )
  const formSubmit      = document.createElement( `button` )
  const formFields      = [
    { categoryName:`subject`,     scale:[ 0, 1, 2 ] },        // Zgodność z tematem
    { categoryName:`impressions`, scale:[ 0, 1, 2, 3, 4 ] },  // Ogólne wrażenie, wywołana ciekawość, chęć zobaczenia kontynuacji, zaskoczenie
    { categoryName:`realisation`, scale:[ 0, 1, 2, 3, 4 ] },  // Spójność produktu, dobrze dobrane wizualia
    { categoryName:`readability`, scale:[ 0, 1, 2 ] },        // Czytelność i jasność zasad. Czy wiadomo co robić (jeśli błądzisz, czy wiesz o tym ze czegos szukasz)
  ]

  scaleWrapper.className = `form-scale`

  fieldsets.className = `form-fieldsets`
  fieldsets.appendChild( scaleWrapper )

  const scaleValues = new Set()

  formFields.forEach( ({ categoryName, scale }) => {
    const fieldset = document.createElement( `fieldset` )
    const category = document.createElement( `span` )

    category.className = `form-category_name`
    category.textContent = categoryName

    fieldset.className = `form-fieldset`
    fieldset.dataset.name = categoryName
    fieldset.appendChild( category )

    const defaultCheckedInput = document.createElement( `input` )
    defaultCheckedInput.type = `radio`
    defaultCheckedInput.name = categoryName
    defaultCheckedInput.value = -1
    defaultCheckedInput.style.display = `none`
    defaultCheckedInput.className = `form-input`
    defaultCheckedInput.checked = true

    fieldset.appendChild( defaultCheckedInput )

    scale.forEach( value => {
      const input = document.createElement( `input` )

      scaleValues.add( value )

      input.type = `radio`
      input.name = categoryName
      input.value = value
      input.className = `form-input`

      fieldset.appendChild( input )
    } )

    fieldsets.appendChild( fieldset )
    fieldsets.appendChild( fieldset )
  } )

  Array.from( scaleValues ).sort( (a,b) => a - b ).forEach( value => {
    const span = document.createElement( `span` )

    span.textContent = value
    span.className = `form-scale_value`

    scaleWrapper.appendChild( span )
  } )

  formSubmit.textContent = `Prześlij ocenę`
  formSubmit.type = `submit`
  formSubmit.addEventListener( `click`, async e => {
    e.preventDefault()

    const values = formFields.reduce( (obj, { categoryName }) => {
      return { ...obj, [categoryName]:form[ categoryName ].value }
    }, {} )

    fetch( `/api/voteOnGame/${userId}`, {
      method: `POST`,
      headers: { "Content-Type": `application/json`, ...getAuthHeader() },
      body: JSON.stringify( values )
    } )
      .then( res => res.json() )
      .then( res => {
        //if (res.error) return showFormError( form )
      } )
  } )

  form.className = `form`
  form.appendChild( fieldsets )
  form.appendChild( formSubmit )

  return form
}


function getGameHtmlListItem( userId, nickname, description, avatarUrl ) {
  const li   = document.createElement( `li` )
  const tile = getGameHtmlTile( nickname, description, avatarUrl )
  const form = getToken() ? getGameHtmlForm( userId ) : null

  li.className = `game`
  li.dataset.userId = userId

  li.appendChild( tile )
  if (form) li.appendChild( form )

  return li
}


export default async function fetcher() {
  const games = await fetch( `/api/fetchGames` )
    .then( res => res.json() )

  const gamesItems = games.map( ({ userId, username, avatarUrl, games }) => games.map( gamename => {
    const a = `<a download href="/api/downloadGame/${userId}/${gamename}">${gamename}</a>`

    return getGameHtmlListItem( userId, username, a, avatarUrl )
  } ) ).flat()


  fetch( `/api/getMyVotes/`, { headers:getAuthHeader() } )
    .then( res => res.json() )
    .then( allVotes => Object.entries( allVotes ).forEach( ([ userId, votes ]) => {
      console.log({ userId, votes })
      Object.entries( votes ).forEach( ([ category, vote ]) => {
        const input = document.querySelector( `.game[ data-user-id="${userId}" ] input[ name="${category}" ][ value="${vote}" ]` )

        if (input) input.checked = true
      } )
    } ) )

  gamesList.innerHTML = ``
  gamesItems.forEach( gameItem => gamesList.appendChild( gameItem ) )
}
