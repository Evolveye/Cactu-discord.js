import path from "path"
import fs from "fs/promises"
import { ExecutionError } from "../../core/namespaceStructure/ModuleProcessor/ExecutorError.js"
import { parseValues } from "../../core/modules/params.js"
import { MODULES_FOLDER, readNamespaceConfig, resolveNamespaceFolder, writeNamespaceConfig } from "../../core/modules/namespaceConfig.js"
import ModuleRegistry from "../../core/modules/ModuleRegistry.js"
import FileStorage from "../../core/FileStorage/index.js"
import { isModuleDefinition } from "./define.js"
import { compileModule } from "./compile.js"
import type { Guild } from "discord.js"
import type DCModule from "../DiscordModule.js"
import type CactuDiscordBot from "../DiscordBot.js"
import type { ModuleSource, Namespace } from "../../core/namespaceStructure/index.js"
import type { ModuleLoadError, RegisteredModule } from "../../core/modules/ModuleRegistry.js"
import type { AnyModuleDefinition } from "./define.js"

export type NamespaceModulesInfo = {
  /** Global modules this namespace uses */
  enabled: string[]
  /** All global modules */
  available: string[]
  /** This namespace's own modules (`namespaces/<id>--<name>/modules/`), always enabled */
  local: string[]
}

export type AddLocalModuleResult = `added` | `exists` | { error: unknown }

const LOCAL_MODULES_SUBFOLDER = `modules`
const STORAGE_SUBFOLDER = `storage`

/** Global modules (`modules/`) assigned to guild namespaces by their `namespace.json`, plus each namespace's local modules */
export default class DiscordModules {
  readonly global = new ModuleRegistry( MODULES_FOLDER, isModuleDefinition )
  #bot: CactuDiscordBot
  #folders = new Map<string, Promise<string>>()
  #localRegistries = new Map<string, Promise<ModuleRegistry<AnyModuleDefinition>>>()
  #storages = new Map<string, Promise<FileStorage>>()

  constructor( bot:CactuDiscordBot ) {
    this.#bot = bot
  }

  async loadGlobalModules() {
    this.#logErrors( await this.global.loadAll() )
  }

  /** The guild namespace's modules, compiled again on every (re)load of the namespace; also renames the guild's folder after a rename */
  createSource( namespace:Namespace<DCModule>, guild:Guild ): ModuleSource<DCModule> {
    this.#folders.set( guild.id, resolveNamespaceFolder( guild.id, guild.name ) )

    return () => this.#compileNamespaceModules( namespace, guild )
  }

  async getInfo( guildId:string ): Promise<NamespaceModulesInfo> {
    const config = await readNamespaceConfig( await this.#getFolder( guildId ) )
    const localRegistry = await this.#getLocalRegistry( guildId )

    return { enabled:Object.keys( config.modules ), available:this.global.getNames(), local:localRegistry.getNames() }
  }

  /** Assigns a global module to the namespace (or removes it); false when no such global module exists */
  async setEnabled( guildId:string, moduleName:string, enabled:boolean ) {
    if (enabled && !this.global.get( moduleName )) return false

    const folder = await this.#getFolder( guildId )
    const config = await readNamespaceConfig( folder )

    if (enabled) config.modules[ moduleName ] ??= {}
    else delete config.modules[ moduleName ]

    await writeNamespaceConfig( folder, config )
    await this.#rebuildNamespace( guildId )

    return true
  }

  /**
   * Fully reloads one namespace: fresh code of its global and local modules (with their sub-files and shared `modules/_…` helpers),
   * its namespace.json read again, setups cleaned up and run again, events and slash commands reconnected.
   * Other namespaces keep the code they loaded until their own reload. A module failing to load keeps its last working version.
   */
  async reloadNamespace( guildId:string ) {
    const config = await readNamespaceConfig( await this.#getFolder( guildId ) )
    const localRegistry = await this.#getLocalRegistry( guildId )
    const errors:ModuleLoadError[] = []

    for (const moduleName of Object.keys( config.modules )) {
      if (localRegistry.get( moduleName )) continue

      const error = await this.global.load( moduleName )
      if (error) errors.push( error )
    }

    errors.push( ...await localRegistry.loadAll() )

    this.#logErrors( errors )
    await this.#rebuildNamespace( guildId )

    return errors
  }

  /** Like {@link reloadNamespace}, for every global and local module and every namespace */
  async reloadAll() {
    const errors = await this.global.loadAll()
    for (const registry of this.#localRegistries.values()) errors.push( ...await (await registry).loadAll() )

    this.#logErrors( errors )
    await Promise.all( [ ...this.#bot.namespacesData.keys() ].map( guildId => this.#rebuildNamespace( guildId ) ) )

    return errors
  }

  isLoaded( guildId:string ) {
    return this.#bot.namespacesData.has( guildId )
  }

  /** Saves a module file only for this namespace and loads it; a file that isn't a module is removed again */
  async addLocalModule( guildId:string, fileName:string, content:string, force = false ): Promise<AddLocalModuleResult> {
    const folder = path.join( await this.#getFolder( guildId ), LOCAL_MODULES_SUBFOLDER )
    const filePath = path.join( folder, path.basename( fileName ) )
    const moduleName = path.parse( fileName ).name

    const exists = await fs.access( filePath ).then( () => true, () => false )
    if (exists && !force) return `exists`

    await fs.mkdir( folder, { recursive:true } )
    await fs.writeFile( filePath, content )

    const registry = await this.#getLocalRegistry( guildId )
    const error = await registry.load( moduleName )

    if (error) {
      await fs.rm( filePath )
      await registry.load( moduleName )
      return { error:error.error }
    }

    await this.#rebuildNamespace( guildId )

    return `added`
  }

  /** Removes a local module of the namespace; false when it doesn't exist */
  async deleteLocalModule( guildId:string, moduleName:string ) {
    const registry = await this.#getLocalRegistry( guildId )
    const registered = registry.get( moduleName )
    if (!registered) return false

    await fs.rm( registered.path, { recursive:true } )
    await registry.load( moduleName )
    await this.#rebuildNamespace( guildId )

    return true
  }

  async getStorage( namespaceId:string, moduleName:string ) {
    const filePath = path.join( await this.#getFolder( namespaceId ), STORAGE_SUBFOLDER, `${moduleName}.json` )
    let storage = this.#storages.get( filePath )

    if (!storage) {
      storage = fs.mkdir( path.dirname( filePath ), { recursive:true } ).then( () => FileStorage.createStorage( filePath ) )
      this.#storages.set( filePath, storage )
    }

    return storage
  }

  async #compileNamespaceModules( namespace:Namespace<DCModule>, guild:Guild ) {
    const config = await readNamespaceConfig( await this.#getFolder( guild.id ), guild.name )
    const localRegistry = await this.#getLocalRegistry( guild.id )
    const compiled:DCModule[] = []

    const compileRegistered = (registered:RegisteredModule<AnyModuleDefinition>) => {
      const module = this.#compile( registered, namespace, guild, config.prefix ?? ``, config.modules[ registered.name ] ?? {} )
      if (module) compiled.push( module )
    }

    for (const moduleName of Object.keys( config.modules )) {
      // A local module with the same name replaces the global one
      if (localRegistry.get( moduleName )) continue

      const registered = this.global.get( moduleName )
      if (registered) compileRegistered( registered )
      else this.#bot.logSystem( `[fgRed]Namespace "${guild.name}"[]: the global module "${moduleName}" doesn't exist` )
    }

    for (const moduleName of localRegistry.getNames()) compileRegistered( localRegistry.get( moduleName )! )

    return compiled
  }

  #compile( registered:RegisteredModule<AnyModuleDefinition>, namespace:Namespace<DCModule>, guild:Guild, prefix:string, rawSettings:Record<string, unknown> ) {
    const settings = parseValues( registered.definition.settings, name => rawSettings[ name ] )

    if (settings instanceof ExecutionError) {
      this.#bot.logSystem( `[fgRed]Namespace "${guild.name}"[]: wrong setting "${settings.param?.name}" of the module "${registered.name}" (namespace.json)` )
      return null
    }

    try {
      return compileModule( registered.definition, {
        bot: this.#bot,
        namespace,
        guild,
        moduleName: registered.name,
        prefix,
        settings,
        getStorage: () => this.getStorage( guild.id, registered.name ),
      } )
    } catch (error) {
      this.#bot.logSystem( `[fgRed]Namespace "${guild.name}"[]: the module "${registered.name}" failed to compile\n${error}` )
      return null
    }
  }

  /** A guild's folder: resolved (and renamed) when its namespace registers, otherwise found by the ID */
  #getFolder( guildId:string ) {
    let folder = this.#folders.get( guildId )

    if (!folder) {
      folder = resolveNamespaceFolder( guildId )
      this.#folders.set( guildId, folder )
    }

    return folder
  }

  #getLocalRegistry( namespaceId:string ) {
    let registry = this.#localRegistries.get( namespaceId )

    if (!registry) {
      registry = this.#createLocalRegistry( namespaceId )
      this.#localRegistries.set( namespaceId, registry )
    }

    return registry
  }

  async #createLocalRegistry( namespaceId:string ) {
    const registry = new ModuleRegistry( path.join( await this.#getFolder( namespaceId ), LOCAL_MODULES_SUBFOLDER ), isModuleDefinition )
    this.#logErrors( await registry.loadAll() )

    return registry
  }

  async #rebuildNamespace( guildId:string ) {
    await this.#bot.namespacesData.get( guildId )?.reload()
  }

  #logErrors( errors:ModuleLoadError[] ) {
    for (const { name, error } of errors) this.#bot.logSystem( `[fgRed]Module "${name}" failed to load[]\n${error}` )
  }
}
