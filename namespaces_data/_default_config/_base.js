const { createCanvas, loadImage } = await import( `canvas` )
const fs = await import( `fs` )
const fsp = fs.promises

/** @type {import("../../lib/index.js")} */
const { DCModule, DCScope, DCExecutor, DCCmdExecutor, DCFilter } = await import( `@lib/index.js` )

const dcModule = new DCModule({
  prefix: `cc! `,

  commands: new DCScope( {}, {
    nobody: new DCExecutor( { perms:`_NOBODY` }, () => {} ),

    $: new DCScope( {
      perms: `_ADMIN`,
      shortDescription: `Umiejętności mistycznego oka`,
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

      tell: new DCExecutor( {
        shortDescription: `Say something by bot`,
        params: [
          { name:`Czy osadzenie`, type:`bool`, optional:true },
          { name:`Kanał`, type:/<#\d{18}>/, optional:true },
          { name:`Wiadomość`, type:`message` },
        ],
      }, ($, isEmbeded, channelId, text) => {
        const { guild } = $.channel
        const attachmentsUrls = []
        let channel = $.channel

        if ($.msg?.attachments.size) for (const { url } of $.msg.attachments.values()) attachmentsUrls.push( url )
        if (channelId) channel = guild.channels.cache.find( channel => channel.id == channelId.substring( 2, 20 ) )

        if (!isEmbeded) {
          channel.send({ content:text, files:attachmentsUrls })
          $.deleteMsg()
          return
        }

        try {
          if (text.startsWith( `\`\`\`` )) {
            const indexOfSpace = text.indexOf( ` ` )
            const indexOfNewLine = text.indexOf( `\n` )

            const index = indexOfSpace === -1
              ? (indexOfNewLine === -1 ? -1 : indexOfNewLine)
              : (indexOfNewLine === -1 ? indexOfSpace : Math.min( indexOfSpace, indexOfNewLine ))

            text = text.slice( index, -3 )
          }

          channel.send({ files:attachmentsUrls, embeds:[ eval( `(${text})` ) ] })
          $.deleteMsg()
        } catch (err) {
          console.log({ err, text })
          throw `Coś jest nie tak z embedem, którego próbujesz wysłać`
        }
      } ),

      copy: new DCExecutor( {
        shortDescription: `Skopiuj treść istniejącej już wiadomości, i przejślij ją jako bot`,
        params: [
          { name:`Kanał`, type:/<#\d{18}>/, optional:true, desc:`Kanał na który należy wysłac wiadomość` },
          { name:`ID wiadomości`, type:/\d{18}/ },
        ],
      }, async($, channelId, messageId) => {
        const { guild } = $.channel
        const messageToCopy = await $.channel.messages.fetch( messageId )
        let channel = $.channel

        if (channelId) channel = guild.channels.cache.find( channel => channel.id == channelId.substring( 2, 20 ) )
        if (!messageToCopy) {
          $.send( `Wiadomości do skopiowania nie znaleziono` )
          return
        }

        const attachmentsUrls = []

        if (messageToCopy.attachments.size) for (const { url } of messageToCopy.attachments.values()) attachmentsUrls.push( url )

        channel.send({ content:messageToCopy.content, files:attachmentsUrls })
        $.deleteMsg()
      } ),

      edit: new DCExecutor( {
        shortDescription: `Skopiuj treść istniejącej już wiadomości, i przejślij ją jako bot`,
        params: [
          { name:`Kanał celu`, type:/<#\d{18}>/, optional:true },
          { name:`ID celu`, type:/\d{18}/, desc:`ID wiadomości do edycji` },
          { name:`ID źródła`, type:/\d{18}/, desc:`ID wiadomości do skopiowania z tego kanału` },
        ],
      }, async($, destChannelId, destMessageId, srcMessageId) => {
        const { guild } = $.channel
        let destChannel = $.channel

        if (destChannelId) destChannel = guild.channels.cache.find( channel => channel.id == destChannelId.substring( 2, 20 ) )

        const [ destMessage, messageToCopy ] = await Promise.all([
          destChannel.messages.fetch( destMessageId ),
          $.channel.messages.fetch( srcMessageId ),
        ])

        if (!destMessage) return $.send( `Wiadomości do zedytowania nie znaleziono` )
        if (!messageToCopy) return $.send( `Wiadomości do skopiowania nie znaleziono` )

        const attachmentsUrls = []

        if (messageToCopy.attachments.size) for (const { url } of messageToCopy.attachments.values()) attachmentsUrls.push( url )

        destMessage.edit( messageToCopy.content, { files:attachmentsUrls } )
        $.deleteMsg()
      } ),

      react: new DCExecutor( {
        shortDescription: `Skasuj wiadomości`,
        params: [
          { name:`Kanał`, type:/<#\d{18}>/, optional:true },
          { name:`ID wiadomości`, type:/\d{18,19}/ },
          { name:`Reakcja`, type:/^[^<>]{1,3}$|<:\w+:\d{18,19}>/ },
        ],
      }, async($, destChannelId, destMessageId, emoji) => {
        const { guild } = $.channel
        let destChannel = $.channel

        if (destChannelId) destChannel = guild.channels.cache.find( channel => channel.id == destChannelId.substring( 2, 20 ) )

        const destMessage = await destChannel.messages.fetch( destMessageId )

        if (destMessage) destMessage.react( emoji ).catch( () => {} )
      } ),

      delete: new DCExecutor( {
        shortDescription: `Skasuj wiadomości`,
        params: [ { name:`Liczba`, type:`number` } ],
      }, ($, amount) => {
        /** @type {import("discord.js").TextChannel} */const channel =  $.channel
        const count = ++amount < 2
          ? 2
          : amount > 100
            ? 100
            : amount

        channel.bulkDelete( count ).then( deleted => {
          const countOfDeleted = deleted.size - 1
          let endOfMsg = `ostatnich wiadomości`

          if (countOfDeleted == 1) endOfMsg = `ostatnią wiadomość`
          else if (countOfDeleted < 5) endOfMsg = `ostatnie wiadomości`

          $.sendOk( `Usunięto **${countOfDeleted}** ${endOfMsg}`, $.channel )
        } )
      } ),

      eval: new DCExecutor( {
        shortDescription: `Wykonaj podany kod jak osobną komendę`,
        params: [ { name:`Kod`, type:`message` } ],
      }, ($, code) => {
        const orginalSend = $.send
        $.send = data => orginalSend( `${data}` || `*<brak danych>*` )
        $.sendJson = json => $.send( `\`\`\`\n` + JSON.stringify( json, null, 2 ).slice( 0, 1950 ).replace( /`/g, `\\\`` ) + `\n\`\`\`` )

        if (code.startsWith( `\`\`\`` )) code = code.match( /\n(.*)```$/s )?.[ 1 ] ?? code

        try {
          eval( code )
        } catch (err) {
          $.send( err.message || `Błąd wykonywania kodu` )
        }
      } ),
    } ),
  } ),
})

return dcModule
