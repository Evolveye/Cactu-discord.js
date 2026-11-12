import fs from "fs/promises"

export default class ModulesManager {
  async add( filePath:string, content:string, force = false ) {
    if (await this.checkExistance( filePath ) && !force) return false
    await fs.writeFile( filePath, content, `utf-8` )
    return true
  }

  async delete( filePath:string ) {
    if (!await this.checkExistance( filePath )) return true
    await fs.rm( filePath )
    return true
  }

  async checkExistance( filePath:string ) {
    return fs.stat( filePath ).then( () => true ).catch( () => false )
  }
}
