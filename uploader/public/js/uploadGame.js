import { getToken } from "./authorize.js"
import fetcher from "./fetchGames.js"

const ui = {
  /** @type {HTMLFormElement} */
  form: document.querySelector( `.games_sender` ),
  /** @type {HTMLFormElement} */
  input: document.querySelector( `.games_sender-input` ),
}

ui.form.addEventListener( `submit`, e => {
  e.preventDefault()

  const formData = new FormData()

  formData.append( `game`, ui.input.files[ 0 ] )
  formData.append( `token`, getToken() )

  fetch( `/api/sendGame`, { method:`post`, body:formData } )
    .then( res => res.json() )
    .then( console.log )
    .then( fetcher )
} )