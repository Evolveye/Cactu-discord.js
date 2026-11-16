import { createModuleKit, string } from "cactu-discord.js"

export const { settings, defineModule, command, group, filter } = createModuleKit({
  /** Channel logging members joining and leaving; without it, nothing is logged */
  membersLogChannelId: string().optional(),
  /** Role whose members get a direct message report of every vulgarism; without it, nobody does */
  moderatorsRoleId: string().optional(),
  /** Channel where only messages with an attachment or a link may stay */
  findingsChannelName: string().default( `znaleziska` ),
  /** Channel where the vulgarisms filter is off */
  vulgarismsAllowedChannelName: string().default( `weterani` ),
})

export type CactuSettings = typeof settings
