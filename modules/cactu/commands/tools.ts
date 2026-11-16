import { ActionRowBuilder, ButtonBuilder, ButtonStyle } from "discord.js"
import { number } from "cactu-discord.js"
import { deleteCommandMessage } from "../shared.js"
import { command } from "../kit.js"
import { stormCommand } from "./storm.js"
import { minecraftCommand } from "./minecraft.js"
import type { ComponentCtx } from "cactu-discord.js"
import type { CactuSettings } from "../kit.js"

const RANDOM_BUTTON_ID = `random`
const RANDOM_RANGE = /(-?\d+).*?(-?\d+)/
/** Rerolls stop adding lines (and the button disappears) after this many */
const RANDOM_MAX_LINES = 9

export const toolsCommands = {
  random: command({
    description: `Rzuć monetą lub wylosuj liczbę`,
    slash: true,
    params: {
      liczba1: number().optional().describe( `Jedna z liczb zakresu; bez drugiej losuje z przedziału <0; liczba1>` ),
      liczba2: number().optional().describe( `Druga liczba zakresu` ),
    },
    run: (ctx, { liczba1, liczba2 }) => {
      const isCoinFlip = liczba1 === undefined && liczba2 === undefined
      const content = isCoinFlip
        ? `Wykonano rzut monetą\n${describeCoinFlip()}`
        : describeDraw( Math.min( liczba1 ?? 0, liczba2 ?? 0 ), Math.max( liczba1 ?? 0, liczba2 ?? 0 ) )

      return ctx.send({ content, components:[ createRerollRow() ] })
    },
  }),

  storm: stormCommand,

  mc: minecraftCommand,

  ask: command({
    description: `Wyślij informacje o idei "Don't ask to ask"`,
    run: async ctx => {
      await deleteCommandMessage( ctx )
      await ctx.send( ``
        + `Po prostu zadaj pytanie, zamiast pytać o pytanie. `
        + `Może być przecież tak (i to się nie zdarza rzadko), `
        + `że do konkretnego pytania zgłosi się więcej osób niż do nic niemówiącego ogólnika.`
        + `\nhttps://dontasktoask.com`,
      )
    },
  }),
}

/** The "Reroll" button of `random`: draws again from the same range and appends the result */
export async function rerollRandom( ctx:ComponentCtx<CactuSettings> ) {
  const { interaction } = ctx
  if (!interaction.isButton()) return

  const { content } = interaction.message
  const range = content.match( RANDOM_RANGE )
  const result = range ? describeDraw( Number( range[ 1 ] ), Number( range[ 2 ] ) ) : describeCoinFlip()
  const isFull = content.split( `\n` ).length > RANDOM_MAX_LINES

  await interaction.update({ content:`${content}\n${result}`, components:isFull ? [] : undefined })
}

export const randomComponents = { [ RANDOM_BUTTON_ID ]:rerollRandom }

function describeDraw( min:number, max:number ) {
  return `Z zakresu <**\`${min}\`**; **\`${max}\`**> wylosowano **${drawInteger( min, max )}**`
}

function describeCoinFlip() {
  return `Wylosowana wartość to **${drawInteger( 0, 1 ) === 1 ? `orzeł` : `reszka`}**`
}

function drawInteger( min:number, max:number ) {
  return Math.floor( Math.random() * (max - min + 1) ) + min
}

function createRerollRow() {
  return new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder().setCustomId( RANDOM_BUTTON_ID ).setLabel( `Reroll` ).setStyle( ButtonStyle.Primary ),
  )
}
