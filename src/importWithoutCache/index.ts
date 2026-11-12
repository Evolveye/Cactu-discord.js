import fs from "fs/promises"

/** Root of the running library: the repository root when run from sources (Bun), `dist/` when run from the build */
const LIBRARY_ROOT = new URL( `../../`, import.meta.url ).href

/**
 * Evaluates a module config file, so every call runs its current content instead of a cached module.
 * `@lib/` in the file points to this library, wherever it runs from.
 */
export default async function importWithoutCache<T>( path:string ) {
  const moduleCode = await fs.readFile( path, `utf-8` )
  const workerCode = `;(async function() {\n${moduleCode.replaceAll( `@lib/`, LIBRARY_ROOT )}\n})()`

  // Only a syntax error throws here; errors thrown while the module runs reject the returned promise.
  // Evaluating the bot owner's own config files is the purpose of this function.
  try {
    // eslint-disable-next-line sonarjs/code-eval
    return eval( workerCode ) as Promise<null | T>
  } catch {
    return null
  }
}
