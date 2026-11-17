/**
 * The head service's URL, `{uuid}` being the player's Mojang UUID: the one place to change when swapping the service.
 * A 3D head on a transparent background: Discord crops avatars to a circle, which would cut the corners of a flat face.
 */
const HEAD_URL_TEMPLATE = `https://mc-heads.net/head/{uuid}/64`

/** Discord downloads the image itself, so the bot only builds the URL */
export function createHeadUrl( uuid:string ) {
  return HEAD_URL_TEMPLATE.replace( `{uuid}`, encodeURIComponent( uuid ) )
}
