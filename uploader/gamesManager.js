import fs  from "fs"
import formidable from "formidable"

import { reqAuth, getSessionUserFromDiscordUser, getUserFromToken, loadDiscordUser, assertUserDirectory } from "./auth.js"

/** @typedef {import("http").IncomingMessage} ClientRequest */
/** @typedef {import("http").ServerResponse} ServerResponse */

const RESPONSES = {
  NOT_AUTH:       { status:401, message:`Unauthorized route` },
  ONLY_POST:      { status:405, message:`Only POST method operated` },
  ONLY_GET:       { status:405, message:`Only GET method operated` },
  NO_GAME:        { status:400, message:`Missing "game" file` },
  LOGGED_NEEDED:  { status:400, message:`Logged via Discord needed` },
  ONLY_ZIP:       { status:400, message:`Only .zip files operated` },
  WRONG_ANSWER:   { status:400, message:`Wrong form data` },

  SERVER_ERR:     { status:500, message:`Internal server error` },
  SUCCESS:        { status:200, message:`Operation success` },

  GAME_UPLOADED:  { status:200, message:`Game uploaded successfully` },
}


const formFields = [
  { categoryName:`subject`,     scale:[ 0, 1, 2 ] },        // Zgodność z tematem
  { categoryName:`impressions`, scale:[ 0, 1, 2, 3, 4 ] },  // Ogólne wrażenie, wywołana ciekawość, chęć zobaczenia kontynuacji, zaskoczenie
  { categoryName:`realisation`, scale:[ 0, 1, 2, 3, 4 ] },  // Spójność produktu, dobrze dobrane wizualia
  { categoryName:`readability`, scale:[ 0, 1, 2 ] },        // Czytelność i jasność zasad. Czy wiadomo co robić (jeśli błądzisz, czy wiesz o tym ze czegos szukasz)
]


/**
 * @param {ServerResponse} res
 * @param {{ status:number message:string, rest:Record<string,any> }} param1
 */
function end( res, { status, message, rest }, success = (status < 300) ) {
  const json = { success, message, ...rest }

  return res
    .setHeader( `Content-Type`, `application/json` )
    .writeHead( status, message )
    .end( JSON.stringify( json ) )
}


/**
 * @param {ClientRequest} req
 * @param {ServerResponse} res
 * @param {string[]} urlParts
 */
export function handleGame( req, res ) {
  if (req.method.toLowerCase() != `post`) return end( res, RESPONSES.ONLY_POST )

  /** @type {formidable.IncomingForm} */
  const form = formidable({ multiplies:true })

  form.parse( req, (err, fields, files) => {
    if (!files.game) return end( res, RESPONSES.NO_GAME )

    const { path:tempPath, name:filename } = files.game
    const raw = fs.readFileSync( tempPath )
    const session = getUserFromToken( fields.token )

    if (!session) return end( res, RESPONSES.LOGGED_NEEDED )
    if (!/\.zip$/.test( filename )) return end( res, RESPONSES.ONLY_ZIP )

    const { user } = session
    const userPath = `./games/${user.id}`

    if (!fs.existsSync( userPath )) fs.mkdirSync( userPath )

    fs.readdirSync( userPath ).forEach( filename => fs.unlinkSync( `${userPath}/${filename}` ) )
    fs.writeFileSync( `${userPath}/${filename}`, raw )
    fs.writeFileSync( `${userPath}/meta.json`, JSON.stringify( user ) )

    console.log( `Uploading -> ${user.username} :: ${filename}` )

    end( res, RESPONSES.GAME_UPLOADED )
  } )
}


/**
 * @param {ClientRequest} req
 * @param {ServerResponse} res
 * @param {string[]} urlParts
 */
export async function fetchGames( req, res ) {
  if (req.method.toLowerCase() != `get`) return end( res, RESPONSES.ONLY_GET )

  if (!fs.existsSync( `./games/` )) fs.mkdirSync( `./games/` )

  const discordUsersIds = [
    `191576899582033920`, // Tomangelo
    `290565336174952452`, // Pooshek
    `263736841025355777`, // Evolveye
    `406202717313302540`, // Dakuro
    `151606847260983297`, // Pikol
    `200360826396213248`, // Tirex
    `577482143815434252`, // drewnoissue
  ]

  const usersWithGames = await Promise.all( discordUsersIds.map( async userId => {
    await assertUserDirectory( userId )
    const user = JSON.parse( fs.readFileSync( `./games/${userId}/meta.json`, `utf-8` ) )
    return { user,games:[] }
  } ) )

  end( res, {
    status: 200,
    rest:{ usersGames:usersWithGames.reduce( (obj, userGames) => ({ ...obj, [userGames.user.id]:userGames }), {} ) }
  } )
}


/**
 * @param {ClientRequest} req
 * @param {ServerResponse} res
 * @param {string[]} urlParts
 */
export function downloadGame( req, res, urlParts ) {
  if (req.method.toLowerCase() != `get`) return end( res, RESPONSES.ONLY_GET )

  const path = `./games/${urlParts[ 0 ]}/${urlParts[ 1 ]}`

  if (fs.existsSync( path )) res.end( fs.readFileSync( path ) )
  else end( res, RESPONSES.SERVER_ERR )
}


/**
 * @param {ClientRequest} req
 * @param {ServerResponse} res
 * @param {string[]} urlParts
 */
export async function voteOnGame( req, res, urlParts ) {
  console.log( `voteOnGame`, req.method )
  if (req.method.toLowerCase() !== `put`) return end( res, RESPONSES.ONLY_POST )

  const session = reqAuth( req )
  if (!session) return end( res, RESPONSES.NOT_AUTH )
  await assertUserDirectory( session.user.id )

  req.on( `data`, formDataJson => {
    const { user } = session
    const formPosibleAnserws = formFields.reduce(
      (obj, { categoryName, scale }) => ({ ...obj, [ categoryName ]:scale }), {},
    )

    const newVotes = {}
    const formData = JSON.parse( formDataJson )?.categories
    const userPath = `./games/${user.id}/`
    const votesPath = `${userPath}voting.json`
    const metaPath = `${userPath}meta.json`

    for (const [ key, scale ] of Object.entries( formPosibleAnserws )) {
      if (key in formData && scale.includes( Number( formData[ key ] ) )) newVotes[ key ] = Number( formData[ key ] )
      // else return end( res, RESPONSES.WRONG_ANSWER )
    }

    if (!fs.existsSync( votesPath )) fs.writeFileSync( votesPath, `{}` )

    const votes = JSON.parse( fs.readFileSync( votesPath, `utf-8` ) )
    votes[ urlParts[ 0 ] ] ??= {}
    Object.assign( votes[ urlParts[ 0 ] ], newVotes )

    console.log( `Voting :: ${user.displayName} -> ${urlParts[ 0 ]} :: ${JSON.stringify( newVotes )}` )

    fs.writeFileSync( metaPath, JSON.stringify( user ) )
    fs.writeFileSync( votesPath, JSON.stringify( votes ) )

    return end( res, { ...RESPONSES.SUCCESS, rest:{ votes } } )
  } )
}


/**
 * @param {ClientRequest} req
 * @param {ServerResponse} res
 * @param {string[]} urlParts
 */
export async function getMyVotes( req, res, urlParts ) {
  if (req.method.toLowerCase() != `get`) return end( res, RESPONSES.ONLY_POST )

  const session = reqAuth( req )
  if (!session) return end( res, RESPONSES.NOT_AUTH )
  await assertUserDirectory( session.user.id )

  const userFolder = `./games/${session.user.id}`
  const path = `${userFolder}/voting.json`

  if (!fs.existsSync( path )) {
    if (!fs.existsSync( userFolder )) fs.mkdirSync( userFolder )

    fs.writeFileSync( path, `{}` )
  }

  const votes = JSON.parse( fs.readFileSync( path, `utf-8` ) )
  end( res, {status:200, rest:{ votes }})
}


/**
 * @param {ClientRequest} req
 * @param {ServerResponse} res
 * @param {string[]} urlParts
 */
export async function getAllVotes( req, res, urlParts ) {
  if (req.method.toLowerCase() != `get`) return end( res, RESPONSES.ONLY_POST )

  const session = reqAuth( req )
  if (!session) return end( res, RESPONSES.NOT_AUTH )
  if (session.user.id != `263736841025355777`) {
    console.log( `${session.user.displayName} tried to read all votes` )
    return end( res, RESPONSES.NOT_AUTH )
  }

  await assertUserDirectory( session.user.id )

  const votes = []

  fs.readdirSync( `./games` ).forEach( userId => {
    const userFolder = `./games/${userId}`
    const votesPath = `${userFolder}/voting.json`
    const metaath = `${userFolder}/meta.json`

    if (!fs.existsSync( votesPath )) fs.writeFileSync( votesPath, `{}` )

    const userMeta = fs.existsSync( metaath ) ? JSON.parse( fs.readFileSync( metaath ) ) : {}
    const userVotes =  JSON.parse( fs.readFileSync( votesPath, `utf-8` ) )

    userMeta.id = userId

    const processedVotes = Object.entries( userVotes ).map( ([ userId, votes ]) => ({ userId, votes }) )

    votes.push({ ...userMeta, votes:processedVotes })
  } )


  end( res, { status:200, rest:{ votes } } )
}
