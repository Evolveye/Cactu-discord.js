export default {
  prefix: `cc!`,

  commandsMessenger( title, description ) {
    message.channel.send( { embed: {
      color: 0x00A000,
      title,
      description
    } } )
  },

  structure: {
    god: {
      roles: `God`,
      desc: `Special skills`,
  
      eval(
        params = { code:`!!!` },
        roles  = `Owner`,
        desc   = `Evaluate the code`
      ){
        try {
          eval( code )
        }
        catch (err) {
          console.log( err )
          message.reply( `You probably can't programming 🤦` )
        }
      },
    
      delete(
        params = { amount:/\d+/ },
        roles  = `Owner`,
        desc   = `Delete the messages`
      ) {
        let count = ++amount<2  ?  2  :  amount>100  ?  100  :  amount

        message.channel
        .bulkDelete( count )
        .then( deleted => {
          message.channel.send( `✅  Deleted **${deleted.array().length - 1}** last messages` )
        } )
      },
  
      tell(
        params = { channelHash:`/<#\d{18}>(?:embeded)?/`, text:`!!!` },
        desc   = `Send a message`
      ) {
        if (/embeded$/.test( channelHash )) {
          try {
            bot.channels
            .find( `id`, channelHash.substring( 2, 20 ) )
            .send( { embed: eval( `(${text})` ) } )
          }
          catch (err) {}
        }
        else if (channelHash) {
          bot.channels
          .find( `id`, channelHash.substring( 2,20 ) )
          .send( text )
    
        }
        else
          message.channel.send( text )
  
        message.delete()
      }
    },

    cactuses(
      desc = `Show count of harvested cactuses`,
    ) {
      message.channel.send( `We have harvested ${cache.sendedCactuses || 0} cactuses` )
    }
  }
}