/* The events the Cactu backend forwards from the Minecraft server (see MINECRAFT_EVENTS_BOT.md), and their validation */

/** Minecraft's JSON text component: an object, a bare string or number, or an array (the parent first, then its children) */
export type TextComponent = unknown

export type MinecraftPlayer = { uuid: string, name: string }

export type MinecraftEventBase = {
  id: string
  occurredAt: string
  player: MinecraftPlayer & { skinUrl: null | string }
}

export type AdvancementFrame = `task` | `goal` | `challenge`

export type MinecraftEvent = MinecraftEventBase & (
  | { type: `advancement`, data: { key: string, title: TextComponent, description: TextComponent, frame: AdvancementFrame } }
  | { type: `death`, data: { message: TextComponent, cause: string, killer: null | { type: string, player: null | MinecraftPlayer }, world: string, location: { x: number, y: number, z: number } } }
  | { type: `join`, data: { firstJoin: boolean } }
  | { type: `quit`, data: {} }
)

export type MinecraftEventType = MinecraftEvent[ `type` ]

/** `unknown`: a valid event of a type this bot doesn't know yet */
export type ParsedMinecraftEvent =
  | { kind: `event`, event: MinecraftEvent }
  | { kind: `unknown`, id: string, type: string }
  | { kind: `invalid`, reason: string }

type JsonObject = Record<string, unknown>

const ADVANCEMENT_FRAMES:readonly unknown[] = [ `task`, `goal`, `challenge` ] satisfies AdvancementFrame[]

const DATA_VALIDATORS:Record<MinecraftEventType, (data:JsonObject) => boolean> = {
  advancement: data => typeof data.key === `string` && data.title !== undefined && data.description !== undefined && ADVANCEMENT_FRAMES.includes( data.frame ),
  death: data => data.message !== undefined && typeof data.cause === `string` && isKiller( data.killer ) && typeof data.world === `string` && isLocation( data.location ),
  join: data => typeof data.firstJoin === `boolean`,
  quit: () => true,
}

/** `data` is checked only for the known types */
export function parseMinecraftEvent( body:unknown ): ParsedMinecraftEvent {
  if (!isObject( body )) return { kind:`invalid`, reason:`the body isn't an object` }

  const { id, type, occurredAt, player, data } = body
  if (typeof id !== `string` || !id) return { kind:`invalid`, reason:`no id` }
  if (typeof type !== `string` || !type) return { kind:`invalid`, reason:`no type` }
  if (typeof occurredAt !== `string` || Number.isNaN( Date.parse( occurredAt ) )) return { kind:`invalid`, reason:`no occurredAt timestamp` }
  if (!isPlayer( player ) || (player.skinUrl !== null && typeof player.skinUrl !== `string`)) return { kind:`invalid`, reason:`no player` }

  if (!isKnownType( type )) return { kind:`unknown`, id, type }
  if (!isObject( data ) || !DATA_VALIDATORS[ type ]( data )) return { kind:`invalid`, reason:`wrong data of a ${type} event` }

  return { kind:`event`, event:body as MinecraftEvent }
}

function isKnownType( type:string ): type is MinecraftEventType {
  return Object.hasOwn( DATA_VALIDATORS, type )
}

function isObject( value:unknown ): value is JsonObject {
  return typeof value === `object` && value !== null && !Array.isArray( value )
}

function isPlayer( value:unknown ): value is JsonObject & MinecraftPlayer {
  return isObject( value ) && typeof value.uuid === `string` && typeof value.name === `string`
}

function isKiller( value:unknown ) {
  if (value === null) return true

  return isObject( value ) && typeof value.type === `string` && (value.player === null || isPlayer( value.player ))
}

function isLocation( value:unknown ) {
  return isObject( value ) && [ value.x, value.y, value.z ].every( coordinate => typeof coordinate === `number` )
}
