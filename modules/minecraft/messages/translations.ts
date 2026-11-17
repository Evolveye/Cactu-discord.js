/*
  The Polish language file of the server's Minecraft version, from Mojang: version manifest → version JSON → asset index →
  the file by its hash. Cached in the module's _translation/<version>/, so a new version (MINECRAFT_VERSION) downloads its own.
  No English fallback: Mojang ships en_us.json only inside the client jar, and the Polish file has (nearly) every key anyway.
  A missing key falls back to the component's `fallback`, or the key itself.
*/

import path from "node:path"
import fs from "node:fs/promises"
import crypto from "node:crypto"
import type { TranslationLookup } from "./text.js"

/** A flat `{ "key": "format string" }` language file */
export type Translations = Record<string, string>

type VersionManifest = { versions: { id: string, url: string }[] }
type VersionJson = { assetIndex: { url: string } }
type AssetIndex = { objects: Record<string, undefined | { hash: string }> }

/** Mojang's list of every Minecraft version, each with the URL of its version JSON: the only way to find a version's files by its name */
const VERSION_MANIFEST_URL = `https://piston-meta.mojang.com/mc/game/version_manifest_v2.json`

/** Mojang's store of game assets, addressed by hash (`/<first 2 characters>/<hash>`): the asset index gives pl_pl.json's hash, this gives the file */
const RESOURCES_URL = `https://resources.download.minecraft.net`
const TRANSLATIONS_FOLDER = path.join( import.meta.dirname, `..`, `_translation` )
const TRANSLATIONS_FILE = `pl_pl.json`
const POLISH_ASSET = `minecraft/lang/pl_pl.json`
const VERSION_PATTERN = /^[\w.-]+$/
const REQUEST_TIMEOUT = 1000 * 30

const NO_TRANSLATIONS:Translations = {}

/** Loading or loaded translations by version; a failed load is forgotten, so the next event tries again */
const loadedTranslations = new Map<string, Promise<Translations>>()

/** From the cache or downloaded, once per process; never rejects */
export function loadTranslations( version:undefined | string, folder = TRANSLATIONS_FOLDER ) {
  if (!version || !VERSION_PATTERN.test( version )) return Promise.resolve( NO_TRANSLATIONS )

  const loaded = loadedTranslations.get( version )
  if (loaded) return loaded

  const loading = readOrDownloadTranslations( version, path.join( folder, version ) ).catch( (error:Error) => {
    loadedTranslations.delete( version )
    console.log( `minecraft: no Minecraft ${version} language file (${error.message}), translation keys stay untranslated` )
    return NO_TRANSLATIONS
  } )

  loadedTranslations.set( version, loading )

  return loading
}

/** Own keys only, so a key like `constructor` isn't found on the object's prototype */
export function createTranslationLookup( translations:Translations ): TranslationLookup {
  return key => Object.hasOwn( translations, key ) ? translations[ key ] : undefined
}

async function readOrDownloadTranslations( version:string, folder:string ) {
  const filePath = path.join( folder, TRANSLATIONS_FILE )

  const cached = await fs.readFile( filePath, `utf-8` ).catch( () => null )
  if (cached) return JSON.parse( cached ) as Translations

  console.log( `minecraft: downloading the Minecraft ${version} language file` )

  // Parsed before saving, so a broken file never lands in the cache
  const file = await downloadPolish( version )
  const translations = JSON.parse( file ) as Translations

  // Not saving only means downloading again after a restart
  await fs.mkdir( folder, { recursive:true } )
    .then( () => fs.writeFile( filePath, file ) )
    .catch( (error:Error) => console.log( `minecraft: the Minecraft language file wasn't cached (${error.message})` ) )

  return translations
}

async function downloadPolish( version:string ) {
  const manifest = await fetchJson<VersionManifest>( VERSION_MANIFEST_URL )

  const versionUrl = manifest.versions.find( ({ id }) => id === version )?.url
  if (!versionUrl) throw new Error( `no version ${version} in Mojang's version manifest` )

  const versionJson = await fetchJson<VersionJson>( versionUrl )
  const assetIndex = await fetchJson<AssetIndex>( versionJson.assetIndex.url )

  const hash = assetIndex.objects[ POLISH_ASSET ]?.hash
  if (!hash) throw new Error( `no ${POLISH_ASSET} in the asset index` )

  // Assets are stored by their SHA-1, which also proves the download is whole
  const file = Buffer.from( await (await fetchOk( `${RESOURCES_URL}/${hash.slice( 0, 2 )}/${hash}` )).arrayBuffer() )
  if (crypto.createHash( `sha1` ).update( file ).digest( `hex` ) !== hash) throw new Error( `wrong SHA-1 of ${POLISH_ASSET}` )

  return file.toString( `utf-8` )
}

async function fetchJson<T>( url:string ) {
  const response = await fetchOk( url )
  return response.json() as Promise<T>
}

async function fetchOk( url:string ) {
  const response = await fetch( url, { signal:AbortSignal.timeout( REQUEST_TIMEOUT ) } )
  if (!response.ok) throw new Error( `HTTP ${response.status} from ${url}` )

  return response
}
