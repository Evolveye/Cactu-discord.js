import { PermissionsBitField } from "discord.js"
import type { Message } from "discord.js"

/**
 * Checks a command's `perms` against the message author. Entries: `_NOBODY` (deny all), `_BOT` (allow bots, which are denied
 * otherwise), `_ADMIN` (server administrators), a user ID (allow), `!` + user ID (deny), a role name or ID (allow its members).
 * The application owner passes every check except `_NOBODY`; empty perms allow everyone.
 */
export function checkPermissions( perms:string[], message:Message, ownerId:undefined | string ) {
  if (perms.includes( `_NOBODY` )) return false
  if (message.author.bot) return perms.includes( `_BOT` )

  if (!perms.length) return true
  if (message.author.id === ownerId) return true
  if (perms.includes( message.author.id )) return true
  if (perms.includes( `!` + message.author.id )) return false

  const { member } = message
  if (!member) return false

  const roleNamesAndIds = member.roles.cache.map( role => [ role.name, role.id ] ).flat()
  if (perms.some( perm => roleNamesAndIds.includes( perm ) )) return true

  return perms.includes( `_ADMIN` ) && member.permissions.has( PermissionsBitField.Flags.Administrator )
}
