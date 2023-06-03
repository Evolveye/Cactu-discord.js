/** @type {import("../../lib/index.js")} */
const { Module, Scope, DCExecutor } = await import( `@lib/index.js` )

return new Module({
  prefix: `cc! `,
  commands: new Scope( {}, {
    nobody: new DCExecutor( {
      perms: `_NOBODY`,
    }, () => {} ),

    $: new Scope( {
      perms: `_ADMIN`,
    }, {
      reload: new DCExecutor( {}, async $ => {
        $.deleteMsg()
        const newMsg = await $.send( `Przeładowywanie rozpoczęte...` )

        const { failedModules } = await $.ns.reloadConfig()
        newMsg.delete()

        if (failedModules.length === 0) return $.sendOk( `Przeładowywanie zakończone pomyślnie!` )

        $.send( `Przeładowywanie zakończone niepowodzeniem!\n Liczba niezaładowanych modułów: ${failedModules.length}` )
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
