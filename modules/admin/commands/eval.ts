import { command, rest } from "cactu-discord.js"

const CODE_BLOCK = /^```\w*\n(.*)```$/s

export const evalCommand = command({
  description: `Wykonaj podany kod jak osobną komendę`,
  params: { code:rest().describe( `Kod` ) },
  run: async(ctx, { code }) => {
    const send = (data:unknown) => ctx.send( `${data}` || `*<brak danych>*` )
    const sendJson = (json:unknown) => send( `\`\`\`\n` + JSON.stringify( json, null, 2 ).slice( 0, 1950 ).replace( /`/g, `\\\`` ) + `\n\`\`\`` )

    // The evaluated code sees `ctx`, `send`, `sendJson` and `$` (the name the old module configs used)
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const $ = { ...ctx, send, sendJson }
    const source = code.match( CODE_BLOCK )?.[ 1 ] ?? code

    try {
      // eslint-disable-next-line sonarjs/code-eval -- the bot owner's console; only `_ADMIN` reaches this
      await eval( `(async() => {\n${source}\n})()` )
    } catch (error) {
      return send( error instanceof Error ? error.message : `Błąd wykonywania kodu` )
    }
  },
})
