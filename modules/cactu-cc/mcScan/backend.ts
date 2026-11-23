/* The Cactu backend's satellite scans of the Minecraft server, read with the backend's `bot` account key (CACTU_BACKEND_API_KEY), which never sees hidden ones */

import { fitImage } from "./image.js"

export type Scan = {
  id: string
  kind: `monthly` | `manual`
  /** ISO date; scans are ordered by it, then by `id` */
  renderedAt: string
  world: string
  width: number
  height: number
  /** A path on the backend, read with the same key; the image under one path never changes */
  imageUrl: string
}

/** `unavailable`: the backend is down, misconfigured or refuses the key (logged for the bot's owner); `notFound`: gone or hidden */
export type BackendFailure = { failure: `unavailable` | `notFound` }

/** `png` is null when the image can't fit Discord's upload limit, even scaled down; `scale` is 1 for the original image */
export type ScanImage = { png: null | Buffer, scale: number }

/** `before`: only scans older than it */
type ScansQuery = { world?: string, limit: number, before?: Scan }

const SCANS_PATH = `/api/v1/minecraft/satellite/scans`
const REQUEST_TIMEOUT = 1000 * 10
const IMAGE_TIMEOUT = 1000 * 60

// Suggestions have to answer within Discord's 3 seconds
const WORLDS_TIMEOUT = 1000 * 2
const WORLDS_CACHE_TIME = 1000 * 60 * 5

/** Larger images aren't downloaded: even scaled down, they wouldn't fit */
const MAX_DOWNLOAD_BYTES = 1024 * 1024 * 128

let worldsCache:null | { worlds: string[], expiresAt: number } = null

/** Scans newest first */
export async function fetchScans( query:ScansQuery, timeout = REQUEST_TIMEOUT ) {
  const searchParams = new URLSearchParams({ limit:String( query.limit ) })

  if (query.world) searchParams.set( `world`, query.world )

  // Scans of the same time are ordered by id, so `before` alone would skip them
  if (query.before) {
    searchParams.set( `before`, query.before.renderedAt )
    searchParams.set( `beforeId`, query.before.id )
  }

  const response = await requestBackend( `${SCANS_PATH}?${searchParams}`, timeout )
  if (`failure` in response) return response

  const scans = await response.json().catch( () => null ) as null | Scan[]
  if (!Array.isArray( scans )) return { failure:`unavailable` } as BackendFailure

  return scans
}

export async function fetchScan( scanId:string ) {
  const response = await requestBackend( `${SCANS_PATH}/${encodeURIComponent( scanId )}`, REQUEST_TIMEOUT )
  if (`failure` in response) return response

  const scan = await response.json().catch( () => null ) as null | Scan
  if (!scan?.id) return { failure:`unavailable` } as BackendFailure

  return scan
}

/** The worlds with scans, cached for a few minutes; the last known ones (or none) when the backend doesn't answer in time */
export async function fetchWorlds() {
  if (worldsCache && worldsCache.expiresAt > Date.now()) return worldsCache.worlds

  const scans = await fetchScans( { limit:200 }, WORLDS_TIMEOUT )
  if (`failure` in scans) return worldsCache?.worlds ?? []

  const worlds = [ ...new Set( scans.map( scan => scan.world ) ) ].sort()
  worldsCache = { worlds, expiresAt:Date.now() + WORLDS_CACHE_TIME }

  return worlds
}

/** The scan's image, scaled down when it's larger than `uploadLimit` bytes */
export async function downloadScanImage( scan:Scan, uploadLimit:number ): Promise<BackendFailure | ScanImage> {
  const response = await requestBackend( scan.imageUrl, IMAGE_TIMEOUT )
  if (`failure` in response) return response

  // Content-Length tells before the download whether the image can fit at all
  if (Number( response.headers.get( `content-length` ) ) > MAX_DOWNLOAD_BYTES) {
    await response.body?.cancel()
    return { png:null, scale:1 }
  }

  const png = await response.arrayBuffer().then( body => Buffer.from( body ) ).catch( () => null )
  if (!png) return { failure:`unavailable` }

  return fitImage( png, uploadLimit ).catch( (error:Error) => {
    console.log( `cactu-cc: a satellite scan wasn't scaled down (${error.message})` )
    return { png:null, scale:1 }
  } )
}

/** A response with a 2xx status; failures that the bot's owner has to fix get logged */
async function requestBackend( path:string, timeout:number ): Promise<Response | BackendFailure> {
  const backendOrigin = process.env.CACTU_BACKEND_ORIGIN?.replace( /\/+$/, `` )
  const apiKey = process.env.CACTU_BACKEND_API_KEY

  if (!backendOrigin || !apiKey) {
    console.log( `cactu-cc: no satellite scans, CACTU_BACKEND_ORIGIN or CACTU_BACKEND_API_KEY isn't set` )
    return { failure:`unavailable` }
  }

  const response = await fetch( backendOrigin + path, { headers:{ Authorization:`Bearer ${apiKey}` }, signal:AbortSignal.timeout( timeout ) } ).catch( () => null )
  if (!response) return { failure:`unavailable` }
  if (response.status === 404) return { failure:`notFound` }

  // A wrong or revoked key, or the bot account without `satellite.scans.read`
  if (response.status === 401 || response.status === 403) {
    const body = await response.json().catch( () => null ) as null | { code?: string }

    console.log( `cactu-cc: the backend refused the satellite scans (HTTP ${response.status} ${body?.code ?? `?`}), check CACTU_BACKEND_API_KEY and the bot account's permissions` )
    return { failure:`unavailable` }
  }

  if (!response.ok) return { failure:`unavailable` }

  return response
}
