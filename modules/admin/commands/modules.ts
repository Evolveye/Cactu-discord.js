import { bool, command, group, pattern, string } from "cactu-discord.js"
import type { CommandCtx, ModuleLoadError } from "cactu-discord.js"

const guildIdParam = pattern( /^\d{17,20}$/ ).describe( `ID serwera` ).optional()

export const modulesGroup = group({
  description: `Moduły serwera`,
  commands: {
    list: command({
      description: `Wylistuj moduły serwera`,
      params: { guildId:guildIdParam },
      run: async(ctx, { guildId }) => {
        const targetId = guildId ?? ctx.guild?.id
        if (!targetId) return ctx.send( `Nie wiadomo, o który serwer chodzi` )

        const info = await ctx.bot.modules.getInfo( targetId )
        const globalModules = info.available.map( name => info.enabled.includes( name ) ? `**${name}** ✅` : name )

        return ctx.send( `**Moduły globalne** (✅ = włączone): ${globalModules.join( `, ` ) || `brak`}\n**Moduły lokalne**: ${info.local.join( `, ` ) || `brak`}` )
      },
    }),

    enable: command({
      description: `Włącz serwerowi moduł globalny`,
      params: { name:string(), guildId:guildIdParam },
      run: (ctx, { name, guildId }) => setModuleEnabled( ctx, name, guildId, true ),
    }),

    disable: command({
      description: `Wyłącz serwerowi moduł globalny`,
      params: { name:string(), guildId:guildIdParam },
      run: (ctx, { name, guildId }) => setModuleEnabled( ctx, name, guildId, false ),
    }),

    reload: command({
      description: `Przeładuj od nowa moduły serwera: ich kod, namespace.json i setupy`,
      params: { guildId:guildIdParam },
      run: async(ctx, { guildId }) => {
        const targetId = guildId ?? ctx.guild?.id
        if (!targetId) return ctx.send( `Nie wiadomo, o który serwer chodzi` )
        if (!ctx.bot.modules.isLoaded( targetId )) return ctx.send( `Bot nie obsługuje serwera o ID ${targetId}` )

        await ctx.send( `Przeładowywanie rozpoczęte...` )

        const errors = await ctx.bot.modules.reloadNamespace( targetId )
        if (errors.length) return ctx.send( describeReloadErrors( errors ) )

        return ctx.send( `✅ Przeładowywanie zakończone pomyślnie!` )
      },
    }),

    reloadAll: command({
      description: `Przeładuj od nowa wszystkie moduły na wszystkich serwerach`,
      run: async ctx => {
        await ctx.send( `Przeładowywanie wszystkich modułów rozpoczęte...` )

        const errors = await ctx.bot.modules.reloadAll()
        if (errors.length) return ctx.send( describeReloadErrors( errors ) )

        return ctx.send( `✅ Przeładowywanie zakończone pomyślnie!` )
      },
    }),

    add: command({
      description: `Załącznik \`.ts\`/\`.js\` załaduj jako lokalny moduł serwera`,
      params: { force:bool().default( false ).describe( `Nadpisz istniejący` ), guildId:guildIdParam },
      run: async(ctx, { force, guildId }) => {
        if (ctx.source !== `message`) return ctx.send( `Moduły dodaje się wiadomością z załącznikiem` )

        const targetId = guildId ?? ctx.guild?.id
        if (!targetId) return ctx.send( `Nie wiadomo, o który serwer chodzi` )

        const attachments = ctx.message.attachments.filter( attachment => /\.(?:ts|js)$/.test( attachment.name ) )
        if (!attachments.size) return ctx.send( `Należy w załączniku wiadomości wysłać przynajmniej jeden plik \`.ts\` lub \`.js\` zawierający kod modułu` )

        const results = await Promise.all( attachments.map( async attachment => {
          const content = await fetch( attachment.url ).then( response => response.text() )
          return { name:attachment.name, result:await ctx.bot.modules.addLocalModule( targetId, attachment.name, content, force ) }
        } ) )

        const added = results.filter( ({ result }) => result === `added` ).map( ({ name }) => name )
        const existing = results.filter( ({ result }) => result === `exists` ).map( ({ name }) => name )
        const failed = results.filter( ({ result }) => typeof result === `object` ).map( ({ name }) => name )

        const lines = [
          added.length && `✅ **Załadowane**: ${added.join( `, ` )}`,
          existing.length && `**Już istnieją** (aby nadpisać, dodaj parametr "force"): ${existing.join( `, ` )}`,
          failed.length && `**Nie zawierają kodu modułu**: ${failed.join( `, ` )}`,
        ]

        return ctx.send( lines.filter( Boolean ).join( `\n` ) )
      },
    }),

    delete: command({
      description: `Skasuj lokalny moduł serwera`,
      params: { name:string(), guildId:guildIdParam },
      run: async(ctx, { name, guildId }) => {
        const targetId = guildId ?? ctx.guild?.id
        if (!targetId) return ctx.send( `Nie wiadomo, o który serwer chodzi` )

        const deleted = await ctx.bot.modules.deleteLocalModule( targetId, name )
        if (!deleted) return ctx.send( `Lokalny moduł "${name}" nie istnieje` )

        return ctx.send( `✅ Moduł "${name}" został skasowany` )
      },
    }),
  },
})

/** Failed modules keep their last working version, so the bot still works with the old code of these */
function describeReloadErrors( errors:ModuleLoadError[] ) {
  const failedModules = errors.map( ({ name, error }) => `- **${name}**: ${error instanceof Error ? error.message : error}` )
  return `Przeładowywanie zakończone niepowodzeniem! Te moduły działają dalej w poprzedniej wersji:\n${failedModules.join( `\n` )}`
}

async function setModuleEnabled( ctx:CommandCtx, moduleName:string, guildId:undefined | string, enabled:boolean ) {
  const targetId = guildId ?? ctx.guild?.id
  if (!targetId) return ctx.send( `Nie wiadomo, o który serwer chodzi` )

  const changed = await ctx.bot.modules.setEnabled( targetId, moduleName, enabled )
  if (!changed) return ctx.send( `Moduł globalny "${moduleName}" nie istnieje` )

  return ctx.send( `✅ Moduł "${moduleName}" został ${enabled ? `włączony` : `wyłączony`}` )
}
