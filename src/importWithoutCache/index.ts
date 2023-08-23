import fs from "fs"

export default function importWithoutCache<T>( path ) {
  return new Promise<null | T>( async r => {
    const moduleCode = await fs.promises.readFile( path, `utf-8` )
    const workerCode = `
      ;(async function() {
        ${moduleCode.replace( /@lib/g, import.meta.url.match( /(.*)lib/ )![ 0 ].replace( /\\/g, `/` ) )}
      })()
    `
    try {
      r( eval( workerCode ) )
    } catch {
      r( null )
    }
  } )
}
