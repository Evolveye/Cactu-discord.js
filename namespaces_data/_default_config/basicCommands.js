/** @type {import("../../lib/index.js")} */
const { DCModule, DCScope, DCExecutor, DCFilter } = await import( `@lib/index.js` )

const fs = await import( `fs` )
const fsp = fs.promises

return new DCModule({
  prefix: `cc! `,
  filters: [
    new DCFilter( /#zaniepokojenie/, (txt, $) => $.send( `#zaniepokojenie` ) ),
    new DCFilter( /#ranfisz/, (txt, $) => $.send( `Ranfisz ||a może Blacky|| mówi **stop** takim wiadomościom!` ) ),
  ],
  commands: new DCScope( {}, {
    nobody: new DCExecutor( {
      perms: `_NOBODY`,
    }, () => {} ),

    $: new DCScope( {
      perms: `_ADMIN`,
    }, {
      modules: new DCScope( {}, {
        add: new DCExecutor( {
          shortDescription: `Załacznik \`.js\` załaduj jako moduł funkcjonalności danego serwera`,
          params: [
            { name:`Force`, type:`bool`, optional:true },
            { name:`ID serwera`, type:/\d{18,19}/, optional:true },
          ],
        }, async($, force = false, guildId) => {
          /** @type {import("../../lib/index.js").default} */ const bot = $.bot

          guildId ??= $.channel.guildId

          const attachments = $.msg?.attachments

          if (!attachments || !attachments.size) return $.send( `Należy w załączniku wiadomości wysłać przynajmniej jeden plik zawierający kod modułu` )

          const checkedModulesnames = {
            valid: [],
            invalid: [],
          }

          attachments.forEach( a => {
            if (!a.name.endsWith( `.js` )) checkedModulesnames.invalid.push( a )
            else checkedModulesnames.valid.push( a )
          } )

          const nsInfo = bot.getNamespaceInfoFromGuild( guildId )

          if (!nsInfo) return $.send( `Wystąpił probleem z rozczytywaniem docelowego serwera` )

          let duplicatedFilenames = []
          let files

          try {
            files = await Promise.all( checkedModulesnames.valid.map( async a => {
              if (await bot.modulesManager.checkExistance( nsInfo.folderPath + a.name ) && !force) return duplicatedFilenames.push( a.name )
              return {
                name: a.name,
                content: await fetch( a.url ).then( r => r.text() ),
              }
            } ) )
          } catch (err) {
            console.log( err )
          }

          if (duplicatedFilenames.length) {
            $.send( `Przynajmniej jeden z nadesłanych modułów chce nadpisać moduł już istniejący. Aby nadpisać, dodaj parametr "force".\n**Zduplikowane nazwy**: ${duplicatedFilenames}` )
            return
          }

          const checkedFilesExistance = {
            valid: [],
            invalid: [],
          }

          await Promise.all( files.map( async f => {
            const isSuccess = await bot.modulesManager.add( nsInfo.folderPath + f.name, f.content, force )

            if (isSuccess) checkedFilesExistance.valid.push({ path:nsInfo.folderPath + f.name, name:f.name })
            else checkedFilesExistance.invalid.push({ path:nsInfo.folderPath + f.name, name:f.name })
          } ) )

          if (checkedFilesExistance.invalid.length) {
            $.send( `Wystąpił problem z zapisywaniem modułu. Spróbuj ponownie później.\n**Problematyczne moduły**: ${checkedFilesExistance.invalid.map( f => f.name )}` )
            return
          }

          const checkedModules = {
            valid: [],
            invalid: [],
          }

          await Promise.all( checkedFilesExistance.valid.map( async({ path, name }) => {
            const isSuccess = await nsInfo.namespace.loadConfigFromFile( path )

            if (isSuccess) checkedModules.valid.push({ path, name })
            else checkedModules.invalid.push({ path, name })
          } ) )

          if (checkedModules.invalid.length) {
            $.send( `Przynajmniej jeden z nadesłanych plików nie zawiera wewnątrz kodu modułu. \n**Problematyczne pliki**: ${checkedModules.invalid.map( f => f.name )}` )
            checkedModules.invalid.forEach( f => bot.modulesManager.delete( f.path ) )
            return
          }

          $.send( `Moduły załadowane` )
        } ),

        delete: new DCExecutor( {
          shortDescription: `Skasuj podany moduł`,
          params: [
            { name:`Nazwa modułu`, type:`string`, optional:true },
            { name:`ID serwera`, type:`string`, optional:true },
          ],
        }, async($, moduleName, guildId) => {
          /** @type {import("../../lib/index.js").default} */ const bot = $.bot

          guildId ??= $.channel.guildId

          const nsInfo = bot.getNamespaceInfoFromGuild( guildId )
          const guild = bot.client.guilds.cache.get( guildId )
          const filepath = nsInfo.folderPath + moduleName + `.js`

          if (!await bot.modulesManager.checkExistance( filepath )) {
            $.send( `Dla serwera "${guild.name}"moduł "${moduleName}" nie istnieje.` )
            return
          }

          const realPath = fs.realpathSync( filepath )
          await fsp.rm( realPath )
          await nsInfo.namespace.unloadModule( realPath )

          $.send( `Moduł "${moduleName}" serwera "${guild.name}" został skasowany` )
        } ),

        list: new DCExecutor( {
          shortDescription: `Wylistuj moduł danego serwera`,
          params: [ { name:`ID serwera`, type:`string`, optional:true } ],
        }, async($, guildId) => {
          /** @type {import("../../lib/index.js").default} */ const bot = $.bot

          guildId ??= $.channel.guildId

          const nsInfo = bot.getNamespaceInfoFromGuild( guildId )
          const guild = bot.client.guilds.cache.get( guildId )
          const files = (await fsp.readdir( nsInfo.folderPath )).map( f => f.slice( 0, -3 ) )

          $.send( `Moduły serwera "${guild.name}":\n${files.join( `, ` )}` )
        } ),

        reload: new DCExecutor( {}, async $ => {
          $.deleteMsg()
          const newMsg = await $.send( `Przeładowywanie rozpoczęte...` )

          const { failedModules } = await $.ns.reloadConfig()
          newMsg.delete()

          if (failedModules.length === 0) return $.sendOk( `Przeładowywanie zakończone pomyślnie!` )

          $.send( `Przeładowywanie zakończone niepowodzeniem!\n Liczba niezaładowanych modułów: ${failedModules.length}` )
        } ),
      } ),
    } ),

    ping: new DCExecutor( {}, $ => {
      $.send( `pong` )
    } ),

    random: new DCExecutor( {
      shortDescription: `Rzuć moneta, lub wylosuj liczbę`,
      params: [
        { name:`Liczba 1`, type:`number`, optional:true, desc:`jedna z liczb z zakresu. Jeśli nie zostanie podany drugi parametr, jest to liczba w przedziale <0, X>.` },
        { name:`Liczba 2`, type:`number`, optional:true, desc:`Druga liczba zakresu` },
      ],
    }, ($, numA, numB) => {
      const coin = numA === undefined && numB === undefined
      let min = Math.min( numA ?? 0, numB ?? 0 )
      let max = Math.max( numA ?? 0, numB ?? 0 )

      if (coin) {
        min = 0
        max = 1
      }

      const rand = Math.floor( Math.random() * (max - min + 1) ) + min
      const message = coin
        ? `Wykonano rzut monetą\nWylosowana wartość to **${rand === 1 ? `orzeł` : `reszka`}**`
        : `Z zakresu **<**${min}**; **${max}**> wylosowano **${rand}**`

      $.send( message )
    } ),
  } ),
})
