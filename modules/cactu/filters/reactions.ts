import { fileURLToPath } from "url"
import path from "path"
import { filter } from "../kit.js"
import type { FilterCtx } from "cactu-discord.js"
import type { CactuSettings } from "../kit.js"

const FILES_FOLDER = fileURLToPath( new URL( `../files/`, import.meta.url ) )

/** Short answers to phrases of the server's inside jokes */
export const reactionFilters = [
  filter( /^#ranfisz$/, async ctx => {
    if (`bulkDelete` in ctx.channel) await ctx.channel.bulkDelete( 2 )

    const blacky = Math.random() > 0.95 ? ` ||a może Blacky||` : ``
    await ctx.send( `Ranfisz${blacky} mówi **stop** takim wiadomościom!` )
  } ),

  filter( /#było/, ctx => ctx.send( `https://www.youtube.com/watch?v=odRjw1i9s3Q` ) ),

  filter( /. +>{5,} +./, async ctx => {
    await ctx.message.delete()
    await ctx.send( `${ctx.message.content}\nAle jak kto woli ¯\\_(ツ)_/¯` )
  } ),

  filter( /teraz +teraz +teraz/, ctx => sendFile( ctx, `teraz.mp4` ) ),
  filter( /ILE\?/, ctx => sendFile( ctx, `ile.mp4` ) ),
  filter( /emotional damage/, ctx => ctx.send( `https://www.youtube.com/watch?v=Lg4WETxq7nc` ) ),
  filter( /cecemc|ceceemce/, ctx => ctx.runCommand( `mc` ) ),
  filter( /#zaniepokojenie/, ctx => ctx.send( `#zaniepokojeniemocnobardzo` ) ),
  filter( /na prawd[eę]/i, ctx => ctx.send( `Naprawdę* <:zeber:484783723468816394>` ) ),
]

/** A file from `modules/cactu/files/` */
function sendFile( ctx:FilterCtx<CactuSettings>, fileName:string ) {
  return ctx.send({ files:[ path.join( FILES_FOLDER, fileName ) ] })
    .catch( (error:unknown) => console.log( `cactu: can't send modules/cactu/files/${fileName}`, error ) )
}
