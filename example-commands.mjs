( { structure: {
  $: {
    roles: `God`,
    desc: `Special skills`,

    tell( p={ channelHash:`/<#\d{18}>(?:embeded)?/`, text:`!!!` }, d=`Send a message` ) {
      if (/embeded$/.test( channelHash )) {
        try {
          $.bot.channels
          .find( `id`, channelHash.substring( 2, 20 ) )
          .send( { embed: eval( `(${text})` ) } )
        }
        catch (err) {}
      }
      else if (channelHash) {
        $.bot.channels
        .find( `id`, channelHash.substring( 2,20 ) )
        .send( text )
  
      }
      else
        $.message.channel.send( text )

      $.message.delete()
    },
  
    delete( p={ amount:/\d+/ }, r=`Owner`, d=`Delete the messages` ) {
      let count = ++amount<2  ?  2  :  amount>100  ?  100  :  amount

      $.message.channel
      .bulkDelete( count )
      .then( deleted => {
        $.message.channel.send( `✅  Deleted **${deleted.array().length - 1}** last messages` )
      } )
    },

    eval( p={ code:`!!!` }, r=`Owner`, d=`Evaluate the code` ){
      try {
        eval( code )
      }
      catch (err) {
        console.log( err )
        $.message.reply( `You probably can't programming 🤦` )
      }
    }
  },

  cactuses( d=`Show count of harvested cactuses` ) {
    $.message.channel.send( `We have harvested ${$.db.sendedCactuses || 0} cactuses` )
  }
} } )