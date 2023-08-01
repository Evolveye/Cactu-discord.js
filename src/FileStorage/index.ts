import fs from "fs/promises"

export default class FileStorage {
  filePath: string

  cachedData: undefined | Record<string, unknown> = undefined
  #loading: Promise<boolean>

  constructor( filePath:string ) {
    let resolver:(data:boolean) => void

    this.filePath = filePath
    this.#loading = new Promise<boolean>( r => resolver = r )

    FileStorage.get( filePath ).then( obj => {
      this.cachedData = obj
      console.log( `loaded`, filePath, this.cachedData, obj )
      resolver( true )
    } )
  }

  get( key:string ) {
    console.log( this.cachedData, key )
    return this.cachedData?.[ key ]
  }

  async set( key:string, value:unknown ) {
    console.log( this.cachedData, key, value )
    if (!this.cachedData) return

    this.cachedData[ key ] = value

    await fs.writeFile( this.filePath, JSON.stringify( this.cachedData ) )
  }

  static async createStorage( filePath:string ) {
    const storage = new FileStorage( filePath )
    await storage.#loading
    return storage
  }

  static async get( filePath:string ) {
    if (!filePath.endsWith( `.json` )) {
      console.error( `FileStorage :: Wrong file extension, filePath=${filePath}` )
      return
    }

    let fileDataStr = await fs.readFile( filePath, `utf-8` ).catch( () => null )

    if (!fileDataStr) {
      if (!await this.#createStorageFile( filePath )) return
      fileDataStr = await fs.readFile( filePath, `utf-8` ).catch( () => null )
      if (!fileDataStr) return
    }

    let fileData:undefined | Record<string, unknown> = undefined

    try {
      fileData = JSON.parse( fileDataStr )
    } catch {
      return
    }

    if (typeof fileData != `object` || Array.isArray( fileData )) return

    return fileData
  }

  static async #createStorageFile( filePath:string ) {
    if (!filePath.endsWith( `.json` )) return false

    await fs.writeFile( filePath, `{}` )

    return true
  }
}
