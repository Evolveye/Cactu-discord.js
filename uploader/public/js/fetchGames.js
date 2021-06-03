import { getAuthHeader, getToken } from "./authorize.js"

const ui = {
  games: document.querySelector( `.games` ),
  gamesList: document.querySelector( `.games-list` ),
}


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
    {
      label: `Temat`,
      description: `
        <p>Zgodność z tematem</p>

        <ol>
          <li> 0 - Temat nie jest dostrzegalny, lub jest niezwykle szczątkowy
          <li> 1 - Temat występuje przykładowo w tle, okala produkcję, gra jakoś nawiązuje do tematu
          <li> 2 - Temat został zaimplementowany w mechanikach dzieła, mechaniki są spójne z tematem a ich podmiana zupełnie by zmieniła produkt
        </ol>
      `,
      categoryName: `subject`,
      scale: [ 0, 1, 2 ]
    },
    {
      label: `Wrażenia`,
      description: `
        <p>Ogólne wrażenia. Wywołana ciekawosć, chęć zobaczenia kontynuacji, element zaskoczenia, chęć powtarzania gry</p>

        <ol>
          <li> 0 - Monotonia, nuda, brak zaciekawienia odbiorcy, niechęć do przejścia całości lub przejscie z trudem
          <li> 1 - Powiewa deliaktną nudą, fajne ale nie rób więcej
          <li> 2 - Nic dodać nic ująć -- wartosć domyślna, zaznacz jeśli nic szczególnie nie wpłynęło na Twoje wrażenia
          <li> 3 - Sympatyczna produkcja, wywołała przyjemne odczucia lub zachęciła do ponownej gry. Być może zagrałbyś w kontynuację lub wersję 2.0
          <li> 4 - Chcesz więcej, nawet jeśli było coś nie tak to nie ma to zestawienia z plusami. Bardzo przyjemna gra
        </ol>
      `,
      categoryName: `impressions`,
      scale: [ 0, 1, 2, 3, 4 ]
    },
    {
      label: `Realizacja`,
      description: `
        <p>Spójność produktu, dobrze dobrane wizualia</p>

        <ol>
          <li> 0 - Bez składu i ładu -- mało co do siebie pasuje.
          <li> 1 - Niektóre elementy do siebie nie pasują, całość nie współgra najlepiej
          <li> 2 - Nic dodać nic ująć -- wartosć domyślna, zaznacz jeśli nic szczególnie nie wpłynęło na Twoje wrażenia
          <li> 3 - Dobrze dobrane elementy
          <li> 4 - Wszystko świetnie ze sobą współgra razem tworząc jedność
        </ol>
      `,
      categoryName: `realisation`,
      scale: [ 0, 1, 2, 3, 4 ]
    },
    {
      label: `Czytelność`,
      description: `
        <p>Czytelność i jasność zasad. Czy wiadomo co robić (jeśli błądzisz, czy wiesz o tym ze czegos szukasz)</p>

        <ol>
          <li> 0 - Niczego nie zrozumiałeś. Produkt niczego nie tłumaczy i bez pomocy autora nic nie zrobisz
          <li> 1 - Autor musi wyjaśnić drobne kwestie ale poza prostymi dopowiedzeniami produkt względnie się tłumaczy
          <li> 2 - Nikt nic nie musi dopowiadać. Jeśli tak się dzieje, to tylko w sytuacji gdy z gry nie wynika że powinno się do czegos dojść samemu
        </ol>
      `, //
      categoryName: `readability`,
      scale: [ 0, 1, 2 ]
    },
  ]

  scaleWrapper.className = `form-scale`

  fieldsets.className = `form-fieldsets`
  fieldsets.appendChild( scaleWrapper )

  const scaleValues = new Set()

  formFields.forEach( ({ label, categoryName, description, scale }) => {
    const fieldset = document.createElement( `fieldset` )
    const categoryLabel = document.createElement( `span` )
    const category = document.createElement( `div` )
    const categoryDescription = document.createElement( `div` )

    categoryLabel.className = `form-category_name`
    categoryLabel.textContent = label

    categoryDescription.className = `form-category_description`
    categoryDescription.innerHTML = description

    category.className = `form-category`
    category.appendChild( categoryLabel )
    category.appendChild( categoryDescription )

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

  fetch( `/api/getAllVotes/`, { headers:getAuthHeader() } )
    .then( res => res.json() )
    .then( votes => {
      window.votes = votes.map( ({ username, votes:userVotes }) => {
        return {
            username,
            votes: userVotes.map( ({ userId, votes:votesOnUser }) =>
                ({ username:votes.find( ({ id }) => id == userId ).username, userId, votes:votesOnUser })
            )
        }
    } )
    } )

  ui.games.style.display = `block`
  ui.gamesList.innerHTML = ``
  gamesItems.forEach( gameItem => ui.gamesList.appendChild( gameItem ) )
}
