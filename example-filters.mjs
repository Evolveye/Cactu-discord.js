[
  { [/.+>{5,}.+/] () {
    $.message.channel.send(`${message}\n ¯\\\_(ツ)\_/¯`)
    $.message.delete()
  } },
  {
    [/#lol/] () {
      $.message.channel.send('__***LEL.......***__')
    },
    [/#haha/] () {
      $.message.channel.send( `huhu` )
    }
  }
]