/*\
 *
 *  IMPORTED TYPES
 *
\*/



/** @typedef {import("discord.js").Channel} Channel */
/** @typedef {import("discord.js").Collection<Snowflake,MessageAttachment} Attachments */
/** @typedef {import("discord.js").MessageAttachment} MessageAttachment */
/** @typedef {import("discord.js").MessageOptions} MessageOptions */
/** @typedef {import("discord.js").MessageAdditions} MessageAdditions */
/** @typedef {import("discord.js").PermissionOverwriteOptions} PermissionOverwriteOptions */
/** @typedef {import("discord.js").Snowflake} Snowflake */
/** @typedef {import("discord.js").MessageReaction} MessageReaction */
/** @typedef {import("discord.js").User} User */

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


/*\
 *
 *  EXECUTOR VARIABLES
 *
\*/



/**
 * @typedef {Object} ProcessedGuild
 * @property {Snowflake} id
 * @property {string} name
 * @property {() => Channel[]} getChannels
 * @property {(predicate:(channel:Channel) => boolean) => Channel} getChannel
 * @property {() => ProcessedUser[]} getMembers
 * @property {(predicate:(member:ProcessedUser) => boolean) => ProcessedUser} getMember
 */

/**
 * @typedef {Object} ProcessedChannel
 * @property {Snowflake} id
 * @property {string} name
 * @property {ProcessedGuild} guild
 * @property {(message:string) => void} send
 * @property {(message:MessageOptions|MessageAdditions) => Promise<ProcessedMessage>} sendEmbeded
 * @property {(userOrRoleId:Snowflake options:PermissionOverwriteOptions) => Promise<>} updatePermissions
 */

/**
 * @typedef {Object} ProcessedUser
 * @property {Snowflake} id
 * @property {(id:Snowflake) => void} setRole
 * @property {string} displayName
 * @property {string} name
 * @property {string} mention
 */

/**
 * @typedef {Object} ProcessedMessage
 * @property {string} content
 * @property {Snowflake} id
 * @property {() => voic} delete
 * @property {ProcessedUser} author
 * @property {ProcessedChannel} channel
 * @property {ProcessedGuild} guild
 * @property {Attachments} attachments
 */

/**
 * @typedef {Object} Variables
 * @property {ProcessedMessage} message
 * @property {(message:string) => Promise<ProcessedMessage>} sendOk
 * @property {(message:string) => Promise<ProcessedMessage>} sendErr
 */



/*\
 *
 *  REST
 *
\*/




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
