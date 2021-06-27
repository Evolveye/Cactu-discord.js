/** @typedef {import("discord.js")} Discord */
/** @typedef {import("discord.js").Guild} Guild */
/** @typedef {import("discord.js").ImageURLOptions} ImageURLOptions */
/** @typedef {import("discord.js").GuildChannel} GuildChannel */
/** @typedef {import("discord.js").Message} Message */
/** @typedef {import("discord.js").Collection<Snowflake,MessageAttachment} Attachments */
/** @typedef {import("discord.js").MessageAttachment} MessageAttachment */
/** @typedef {import("discord.js").MessageOptions} MessageOptions */
/** @typedef {import("discord.js").MessageAdditions} MessageAdditions */
/** @typedef {import("discord.js").PermissionOverwriteOptions} PermissionOverwriteOptions */
/** @typedef {import("discord.js").Snowflake} Snowflake */
/** @typedef {import("discord.js").MessageReaction} MessageReaction */
/** @typedef {import("discord.js").User} User */
/** @typedef {import("discord.js").GuildMember} GuildMember */

/** @typedef {import("./GuildDataset.js").GuildModuleTranslation} GuildModuleTranslation */
/** @typedef {import("./GuildDataset.js").GuildModuleFilters} GuildModuleFilters */
/** @typedef {import("./GuildDataset.js").GuildModuleRoles} GuildModuleRoles */
/** @typedef {import("./GuildDataset.js").GuildModuleCommandsField} GuildModuleCommandsField */
/** @typedef {import("./GuildDataset.js").GuildModuleCommands} GuildModuleCommands */
/** @typedef {import("./GuildDataset.js").GuildModule} GuildModule */
/** @typedef {import("./GuildDataset.js").UnsafeVariables} GuildModule */
/** @typedef {import("./CommandProcessor.js").CommandState} CommandState */
/** @typedef {import("./CommandProcessor.js").CommandErrorType} CommandErrorType */
/** @typedef {import("./CommandProcessor.js").CommandError} CommandError */
/** @typedef {import("./CommandProcessor.js").Command} Command */



/** @typedef {"@everyone" | "@bot_owner" | "@dm" | "@server_admin" | "@bot" | "@<user id>" | "<role name or ID>"} Permission */

/**
 * @typedef {object} DiscordCommandElementMetaPart
 */

/** @typedef {CommandState & DiscordCommandElementMetaPart} DiscordCommandState */

/**
 * @typedef {Object} CactuDiscordBotConfig
 * @property {string} token
 * @property {string} [prefix]
 * @property {boolean} [prefixSpace]
 * @property {Object<string,*>} [publicVars]
 * @property {{ok:string,warn:string,error:string}} [signs]
 * @property {number} [logMaxLength]
 */
