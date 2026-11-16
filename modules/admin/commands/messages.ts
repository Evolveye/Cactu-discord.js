import { bool, channel, command, number, pattern, rest } from "cactu-discord.js"
import type { APIEmbed } from "discord.js"
import type { CommandCtx } from "cactu-discord.js"

const channelParam = channel().describe( `Kanał` ).optional()
const messageIdParam = pattern( /^\d{17,20}$/ ).describe( `ID wiadomości` )

export const messagesCommands = {
  tell: command({
    description: `Powiedz coś jako bot`,
    params: { embed:bool().default( false ).describe( `Czy osadzenie` ), channel:channelParam, text:rest().describe( `Wiadomość` ) },
    run: async(ctx, { embed, channel:channelId, text }) => {
      const target = resolveChannel( ctx, channelId )
      if (!target?.isSendable()) return ctx.send( `Nie znaleziono kanału` )

      const files = getAttachmentsUrls( ctx )

      try {
        await target.send( embed ? { files, embeds:[ parseEmbed( text ) ] } : { content:text, files } )
        await deleteCommandMessage( ctx )
      } catch (error) {
        console.log({ error, text })
        return ctx.send( embed ? `Coś jest nie tak z embedem, którego próbujesz wysłać` : `Nie udało się wysłać wiadomości` )
      }
    },
  }),

  copy: command({
    description: `Skopiuj treść istniejącej już wiadomości i prześlij ją jako bot`,
    params: { channel:channelParam, messageId:messageIdParam },
    run: async(ctx, { channel:channelId, messageId }) => {
      const target = resolveChannel( ctx, channelId )
      if (!target?.isSendable()) return ctx.send( `Nie znaleziono kanału` )

      const messageToCopy = await ctx.channel?.messages.fetch( messageId ).catch( () => null )
      if (!messageToCopy) return ctx.send( `Wiadomości do skopiowania nie znaleziono` )

      await target.send({ content:messageToCopy.content, files:messageToCopy.attachments.map( ({ url }) => url ) })
      await deleteCommandMessage( ctx )
    },
  }),

  edit: command({
    description: `Zastąp treść wiadomości bota treścią innej wiadomości z tego kanału`,
    params: { channel:channelParam, targetId:messageIdParam.describe( `ID wiadomości do edycji` ), sourceId:messageIdParam.describe( `ID wiadomości do skopiowania z tego kanału` ) },
    run: async(ctx, { channel:channelId, targetId, sourceId }) => {
      const target = resolveChannel( ctx, channelId )

      const [ messageToEdit, messageToCopy ] = await Promise.all([
        target?.messages.fetch( targetId ).catch( () => null ),
        ctx.channel?.messages.fetch( sourceId ).catch( () => null ),
      ])

      if (!messageToEdit) return ctx.send( `Wiadomości do zedytowania nie znaleziono` )
      if (!messageToCopy) return ctx.send( `Wiadomości do skopiowania nie znaleziono` )

      await messageToEdit.edit({ content:messageToCopy.content, files:messageToCopy.attachments.map( ({ url }) => url ) })
      await deleteCommandMessage( ctx )
    },
  }),

  react: command({
    description: `Dodaj reakcję do wiadomości`,
    params: { channel:channelParam, messageId:messageIdParam, emoji:pattern( /^[^<>]{1,3}$|<:\w+:\d{17,20}>/ ).describe( `Reakcja` ) },
    run: async(ctx, { channel:channelId, messageId, emoji }) => {
      const message = await resolveChannel( ctx, channelId )?.messages.fetch( messageId ).catch( () => null )
      await message?.react( emoji ).catch( () => undefined )
    },
  }),

  delete: command({
    description: `Skasuj ostatnie wiadomości`,
    params: { count:number().describe( `Liczba` ) },
    run: async(ctx, { count }) => {
      if (!ctx.channel || !(`bulkDelete` in ctx.channel)) return ctx.send( `Tutaj nie da się kasować wiadomości` )

      // One more for the command message itself; Discord deletes 2 to 100 messages at once
      const deleted = await ctx.channel.bulkDelete( Math.min( Math.max( count + 1, 2 ), 100 ) )
      const deletedCount = deleted.size - 1

      return ctx.send( `✅ Usunięto **${deletedCount}** ${pluralizeMessages( deletedCount )}` )
    },
  }),
}

/** The channel given to the command, or the channel the command came from */
function resolveChannel( ctx:CommandCtx, channelId:undefined | string ) {
  const target = channelId ? ctx.guild?.channels.cache.get( channelId ) : ctx.channel
  return target?.isTextBased() ? target : null
}

function getAttachmentsUrls( ctx:CommandCtx ) {
  return ctx.source === `message` ? ctx.message.attachments.map( ({ url }) => url ) : []
}

async function deleteCommandMessage( ctx:CommandCtx ) {
  if (ctx.source === `message`) await ctx.message.delete().catch( () => undefined )
}

/** An embed written as a JS object literal, optionally inside a code block */
function parseEmbed( text:string ): APIEmbed {
  const code = text.replace( /^```\w*\s*|```$/g, `` )

  // eslint-disable-next-line sonarjs/code-eval -- administrators write embeds as JS objects; only `_ADMIN` reaches this
  return eval( `(${code})` )
}

function pluralizeMessages( count:number ) {
  if (count === 1) return `ostatnią wiadomość`
  if (count > 1 && count < 5) return `ostatnie wiadomości`

  return `ostatnich wiadomości`
}
