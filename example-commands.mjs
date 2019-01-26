( { structure: {
  $: {
    roles: `God`,
    desc: `God skills`,

    tell( p={ channelHash:`/<#\d{18}>(?:embeded)?/`, attachments:`/att/`, text:`!!!` }, d=`Send message by bot` ) {
      let attachmentsUrls = []

      if (attachments === `att`)
        for (let [name, att] of $.message.attachments)
          attachmentsUrls.push( att.url )

      if (/embeded$/.test( channelHash )) {
        try {
          $.bot.discordClient.channels
          .find( `id`, channelHash.substring( 2, 20 ) )
          .send( { embed:eval( `(${text})` ), files:attachmentsUrls } )

        } catch(err) {}
    
      } else if (channelHash) {
        $.bot.discordClient.channels
        .find( `id`, channelHash.substring( 2,20 ) )
        .send( text, { files:attachmentsUrls } )
    
      } else
        $.message.channel.send( text, { files:attachmentsUrls } )

      $.message.delete()
    },

    edit( p={ channelHash:`/<#\d{18}>/`, botMessageId:/\d{18}/, newText:`!!!` }, d=`Send message by bot` ) {
        let msg = $.message
        let channel = msg.channel

        if (channelHash)
          channel = $.bot.discordClient.channels.find( `id`, channelHash.substring( 2,20 ) )

        channel  
        .fetchMessage( botMessageId )
        .then( msg => msg.edit( newText ) )
        .catch( () => msg.channel.send( `🤦 You send me wrong ID` ) )
        msg.delete()
    },
    
    delete( p={ amount:/\d+/ }, r=`Owner`, d=`Remove messages` ) {
        let count = ++amount < 2  ?  2  :  amount > 100  ?  100  :  amount

        $.message.channel
        .bulkDelete( count )
        .then( deleted =>
          $.message.channel.send( `✅  Removed **${deleted.array().length - 1}** last messages` )
        )
    },

    eval( p={ code:`!!!` }, r=`Owner`, d=`Evaluate the code` ){
        try {
          eval( code )
        }
        catch (err) {
          console.log( err )
          $.message.reply( `You aren't good programmer ;/` )
        }
    },
  },

  tell( p={ text:`!!!` }, r=`cactus`, d=`Send the message by bot` ) {
    let msg = $.message
    
    console.log( ` ${msg.author.username}:  ${text}` )
    
    if (/@everyone|@here/.test( text ))
      text = `nope ;f`

    msg.channel.send( text )
    msg.delete()
  },

  poll( p={ seconds:`/[0-9]+/`, responses:`/\[[^\[\]]+\]/`, question:`!!!` }, d=`Create poll \Pattern for answers: [1|2|...|9]` ) {
    if ($.db.an_active) {
      $.message.channel.send( `👹 Wait! You need to wait until the current poll will over` )
      return
    }

    if( !seconds )
      seconds = 10

    if( seconds > 120 )
      seconds = 120

    if( !responses )
      responses = '[Tak|Nie]'

    responses = responses.slice( 1, -1 ).split( '|' )

    if( responses.length > 9 ) {
      $.message.channel.send( '👹 You are crazy! Too much answers! 👹' )
      return
    }

    let nums = ['1⃣','2⃣','3⃣','4⃣','5⃣','6⃣','7⃣','8⃣','9⃣']
    let responsesString = ( () => {
      let res = ''

      for( let r of responses )
        res += `\n${nums[responses.indexOf( r )]} ${r}`

      return res
    } )()

    $.message.channel.send( `❔ ${question}${responsesString}` ).then( msg => {
      $.db.an_active = true
      for( let i = 0;  i < responses.length;  i++ )
        ( i => setTimeout( () => msg.react( nums[i] ), i*400 ) )( i )

      setTimeout( () => {
        let response = ''
        let reactions = msg.reactions

        for(let reaction of reactions) {
          response += `${reaction[0]} ${reaction[1].count-1} \n`
        }

        $.db.an_active = false
        $.message.channel.send( response )
      }, seconds * 1000 )
    } )
  },
} } )