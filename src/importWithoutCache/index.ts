import fs from "fs/promises"

export default function importWithoutCache<T>( path ) {
  return new Promise<T>( async r => {
    const moduleCode = await fs.readFile( path, `utf-8` )
    const workerCode = `
      ;(async function() {
        ${moduleCode.replace( /@lib/g, `file://${process.cwd().replace( /\\/g, `/` )}/lib` )}
      })()
    `
    r( eval( workerCode ) )
  } )
}
