export default [
  { [/.*>{5,}.*/] () {
    message.channel.send(`${msg}\nBut as you prefer`)
    message.delete()
  } },
  {
    [/^#cactus$/] () { message.channel.send(`Me? 🌵`) },
    [/cactus/] () {
      if (cache.sendedCactuses)
        cache.sendedCactuses = 0
        
      cache.sendedCactuses++
    }
  },
]