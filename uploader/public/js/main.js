import { onAuthorize } from "./authorize.js"
import "./uploadGame.js"
import fetcher from "./fetchGames.js"

onAuthorize( fetcher )