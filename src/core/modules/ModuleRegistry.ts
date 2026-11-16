import path from "path"
import fs from "fs/promises"
import importFresh, { addReloadableRoot } from "./importFresh.js"

export type RegisteredModule<TDefinition> = {
  name: string
  /** The module's file, or its folder for a multi-file module */
  path: string
  definition: TDefinition
}

export type ModuleLoadError = { name: string, error: unknown }

type ModuleEntry = { name: string, path: string, entryPath: string }

/** Names starting with `_` aren't modules, e.g. `modules/_shared/` with helpers several modules import */
const MODULE_FILE = /^(?<name>[^._].*)\.(?:ts|js)$/
const INDEX_FILES = [ `index.ts`, `index.js` ]

/**
 * The modules of a folder: `<name>.ts|js` files and `<name>/index.ts|js` folders, each exporting its definition as default.
 * Everything in the folder reloads together with the module importing it.
 */
export default class ModuleRegistry<TDefinition> {
  readonly folder: string
  #isDefinition: (value:unknown) => value is TDefinition
  #modules = new Map<string, RegisteredModule<TDefinition>>()

  constructor( folder:string, isDefinition:(value:unknown) => value is TDefinition ) {
    this.folder = path.resolve( folder )
    this.#isDefinition = isDefinition

    addReloadableRoot( this.folder )
  }

  get( name:string ) {
    return this.#modules.get( name )
  }

  getNames() {
    return [ ...this.#modules.keys() ]
  }

  /** (Re)loads every module of the folder; modules whose files are gone are forgotten, a failing one keeps its last working version */
  async loadAll() {
    const entries = await this.#findEntries()
    const errors:ModuleLoadError[] = []

    for (const name of this.#modules.keys()) {
      if (!entries.some( entry => entry.name === name )) this.#modules.delete( name )
    }

    for (const entry of entries) {
      const error = await this.#loadEntry( entry )
      if (error) errors.push( error )
    }

    return errors
  }

  /** (Re)loads one module; returns its error, if any (a failing module keeps its last working version) */
  async load( name:string ): Promise<null | ModuleLoadError> {
    const entry = (await this.#findEntries()).find( found => found.name === name )

    if (!entry) {
      this.#modules.delete( name )
      return { name, error:new Error( `Module "${name}" doesn't exist in ${this.folder}` ) }
    }

    return this.#loadEntry( entry )
  }

  async #loadEntry( entry:ModuleEntry ): Promise<null | ModuleLoadError> {
    try {
      const imported = await importFresh( entry.entryPath ) as { default?: unknown }
      if (!this.#isDefinition( imported.default )) throw new Error( `The default export isn't a module definition` )

      this.#modules.set( entry.name, { name:entry.name, path:entry.path, definition:imported.default } )

      return null
    } catch (error) {
      return { name:entry.name, error }
    }
  }

  async #findEntries() {
    const dirents = await fs.readdir( this.folder, { withFileTypes:true } ).catch( () => [] )
    const entries:ModuleEntry[] = []

    for (const dirent of dirents) {
      const entryPath = path.join( this.folder, dirent.name )

      if (dirent.isFile()) {
        const name = dirent.name.match( MODULE_FILE )?.groups?.name
        if (name && !name.endsWith( `.d` )) entries.push({ name, path:entryPath, entryPath })
        continue
      }

      if (!dirent.isDirectory() || dirent.name.startsWith( `_` )) continue

      const indexFile = await findFirstExisting( INDEX_FILES.map( file => path.join( entryPath, file ) ) )
      if (indexFile) entries.push({ name:dirent.name, path:entryPath, entryPath:indexFile })
    }

    return entries
  }
}

async function findFirstExisting( paths:string[] ) {
  for (const candidate of paths) {
    if (await fs.access( candidate ).then( () => true, () => false )) return candidate
  }

  return null
}
