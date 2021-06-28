/** @typedef {import("discord.js").Guild} Guild */
/** @typedef {import("discord.js").ImageURLOptions} ImageURLOptions */
/** @typedef {import("discord.js").GuildChannel} GuildChannel */
/** @typedef {import("discord.js").Message} Message */
/** @typedef {import("discord.js").Snowflake} Snowflake */
/** @typedef {import("discord.js").Collection<Snowflake,MessageAttachment} Attachments */
/** @typedef {import("discord.js").MessageAttachment} MessageAttachment */
/** @typedef {import("discord.js").MessageOptions} MessageOptions */
/** @typedef {import("discord.js").MessageAdditions} MessageAdditions */
/** @typedef {import("discord.js").PermissionOverwriteOptions} PermissionOverwriteOptions */
/** @typedef {import("discord.js").User} User */
/** @typedef {import("discord.js").GuildMember} GuildMember */



export class ProcessedGuild {
  /** @type {Guild} */
  #guild = null


  get channels() {
    return this.#guild.channels.cache.array().map( channel => new ProcessedChannel( channel ) )
  }
  get members() {
    return this.#guild.members.cache.array().map( member => new ProcessedUser( member ) )
  }


  /** @param {Guild} guild */
  constructor( guild ) {
    this.#guild = guild

    this.id = guild.id
    this.name = guild.name
  }


  /** @param {(predicate:(channel:ProcessedChannel) => boolean} predicate */
  getChannel( predicate ) {
    const { channels } = this

    return channels.find( predicate )
  }


  getMember( predicate ) {
    const { members } = this

    return members.find( predicate )
  }
}



export class ProcessedChannel {
  /** @type {GuildChannel} */
  #channel = null


  /** @param {GuildChannel} channel */
  constructor( channel ) {
    this.#channel = channel

    this.id = channel.id
    this.name = channel.name
    this.guild = new ProcessedGuild( channel.guild )
  }


  /** @param {string|MessageOptions|MessageAdditions} message */
  async send( message ) {
    if (this.#channel.type == `text`) return this.#channel.send( message ).then( message => new ProcessedMessage( message ) )
    else return false
  }


  async updatePermissions() {
    throw `not implemented`
  }
}



export class ProcessedUser {
  /** @type {User} */
  #user = null

  /** @type {GuildMember} */
  #member = null

  get avatarUrl() {
    return this.#user.displayAvatarURL({ format:`png` })
  }


  /** @param {GuildMember|User} memberOrUser */
  constructor( memberOrUser ) {
    this.#user = `username` in memberOrUser ? memberOrUser : memberOrUser.user
    this.#member = `username` in memberOrUser ? null : memberOrUser

    const user = this.#user
    const member = this.#member

    this.id = user.id
    this.displayName = member ? member.displayName : user.username
    this.name = user.username
    this.discriminator = user.discriminator
  }


  /** @param {ImageURLOptions} options */
  getAvatarUrl( options ) {
    return this.#user.displayAvatarURL( options )
  }
}



export class ProcessedMessage {
  /** @type {Message} */
  #message = null


  /** @param {Message} message */
  constructor( message ) {
    this.#message = message

    this.id = message.id
    this.content = message.content
    this.author = new ProcessedUser( message.member ?? message.user )
    this.channel = new ProcessedChannel( message.channel )
    this.guild = new ProcessedGuild( message.guild )
    this.attachments = message.attachments
  }


  delete() {
    return this.#message.delete().then( message => new ProcessedMessage( message ) )
  }
}
