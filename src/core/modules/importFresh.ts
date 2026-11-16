import { fileURLToPath, pathToFileURL } from "url"
import path from "path"
import * as nodeModule from "module"

const require = nodeModule.createRequire( import.meta.url )
const isBun = `Bun` in globalThis
const RELOAD_PARAM = `cactu-reload`

/** Folders whose files are always imported fresh, together with the module importing them (modules and the helpers they share) */
const reloadableRoots = new Set<string>()
let reloadVersion = 0
let areNodeHooksRegistered = false

/** Every file under these folders gets imported fresh on every `importFresh` */
export function addReloadableRoot( folder:string ) {
  reloadableRoots.add( path.resolve( folder ) )
}

/**
 * Imports the current code of a module instead of a cached copy, with every file it imports from the reloadable roots
 * (its sub-files and shared helpers). Files outside the roots (the library, node_modules) stay shared.
 * - Bun: the roots' files are dropped from the module cache
 * - Node: the entry gets a new `?cactu-reload=N`, which a resolve hook passes on to the files it imports from the roots
 */
export default async function importFresh( entryPath:string ): Promise<unknown> {
  const entryUrl = pathToFileURL( entryPath ).href

  if (isBun) {
    dropBunCache()
    return import( entryUrl )
  }

  registerNodeHooks()
  reloadVersion++

  return import( `${entryUrl}?${RELOAD_PARAM}=${reloadVersion}` )
}

function dropBunCache() {
  for (const cachedPath of Object.keys( require.cache )) {
    if (isInReloadableRoot( cachedPath )) delete require.cache[ cachedPath ]
  }
}

/** Without `module.registerHooks` (Node < 22.15) only the entry file reloads */
function registerNodeHooks() {
  if (areNodeHooksRegistered || !(`registerHooks` in nodeModule)) return

  areNodeHooksRegistered = true

  nodeModule.registerHooks({
    resolve( specifier, context, nextResolve ) {
      const resolved = nextResolve( specifier, context )

      const version = context.parentURL ? new URL( context.parentURL ).searchParams.get( RELOAD_PARAM ) : null
      if (!version || !resolved.url.startsWith( `file:` )) return resolved

      if (!isInReloadableRoot( fileURLToPath( resolved.url.split( `?` )[ 0 ]! ) )) return resolved

      const url = new URL( resolved.url )
      url.searchParams.set( RELOAD_PARAM, version )

      return { ...resolved, url:url.href }
    },
  })
}

function isInReloadableRoot( filePath:string ) {
  const resolvedPath = path.resolve( filePath )
  return [ ...reloadableRoots ].some( root => resolvedPath === root || resolvedPath.startsWith( root + path.sep ) )
}
