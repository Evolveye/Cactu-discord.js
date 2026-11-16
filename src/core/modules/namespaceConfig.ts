import path from "path"
import fs from "fs/promises"

/** `namespace.json`: which global modules a namespace uses, with their settings */
export type NamespaceConfig = {
  name?: string
  prefix?: string
  /** Global module name → its settings in this namespace */
  modules: Record<string, Record<string, unknown>>
}

export const NAMESPACES_FOLDER = `namespaces`
export const MODULES_FOLDER = `modules`

const CONFIG_FILE = `namespace.json`
const DEFAULT_CONFIG_FILE = `_default.json`
const NAME_SEPARATOR = `--`
const FOLDER_NAME_LENGTH = 20

/**
 * The namespace's folder, `<id>--<name>` so it's easy to find by eye. It's found by the ID alone, so a renamed namespace keeps its
 * data: with `name` given, the folder is renamed to match (when that fails, e.g. while a file is open, the old name stays).
 */
export async function resolveNamespaceFolder( namespaceId:string, name?:string, root = NAMESPACES_FOLDER ) {
  const entries = await fs.readdir( root ).catch( () => [] as string[] )
  const existing = entries.find( entry => entry === namespaceId || entry.startsWith( namespaceId + NAME_SEPARATOR ) )
  const wanted = name ? namespaceId + NAME_SEPARATOR + toFolderName( name ) : (existing ?? namespaceId)

  if (!existing) {
    await fs.mkdir( path.join( root, wanted ), { recursive:true } )
    return path.join( root, wanted )
  }

  if (existing === wanted) return path.join( root, existing )

  return fs.rename( path.join( root, existing ), path.join( root, wanted ) )
    .then( () => path.join( root, wanted ), () => path.join( root, existing ) )
}

/** Reads the folder's `namespace.json`; a new namespace gets a copy of `namespaces/_default.json` */
export async function readNamespaceConfig( folder:string, name?:string ): Promise<NamespaceConfig> {
  const existing = await readJson( path.join( folder, CONFIG_FILE ) )
  if (existing) return normalizeConfig( existing )

  const defaultConfig = normalizeConfig( await readJson( path.join( path.dirname( folder ), DEFAULT_CONFIG_FILE ) ) ?? {} )
  const config = { ...defaultConfig, name }

  await writeNamespaceConfig( folder, config )

  return config
}

export async function writeNamespaceConfig( folder:string, config:NamespaceConfig ) {
  await fs.mkdir( folder, { recursive:true } )
  await fs.writeFile( path.join( folder, CONFIG_FILE ), JSON.stringify( config, null, 2 ) + `\n` )
}

/** The first 20 characters, words joined in camel case (`Kaktus intranetowy` → `KaktusIntranetowy`), without characters Windows forbids */
function toFolderName( name:string ) {
  return name
    .slice( 0, FOLDER_NAME_LENGTH )
    .replace( / [^ ]/g, match => match.trim().toUpperCase() )
    .replace( /[<>:"/\\|?*\u0000-\u001f]/g, `` )
    .replace( /[. ]+$/, `` )
    .trim()
}

async function readJson( filePath:string ) {
  const text = await fs.readFile( filePath, `utf-8` ).catch( () => null )
  if (!text) return null

  return JSON.parse( text ) as Partial<NamespaceConfig>
}

function normalizeConfig( config:Partial<NamespaceConfig> ): NamespaceConfig {
  return { ...config, modules:config.modules ?? {} }
}
