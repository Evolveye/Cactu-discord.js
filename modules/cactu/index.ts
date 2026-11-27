/* The Kaktus intranetowy server's module: inside-joke filters, moderation, fun commands and tools. Settings: ./kit.ts */

import { translation } from "./translation.js"
import { defineModule, group } from "./kit.js"
import { vulgarismsFilter } from "./filters/vulgarisms.js"
import { reactionFilters } from "./filters/reactions.js"
import { pollFilter } from "./filters/poll.js"
import { findingsFilter } from "./filters/findings.js"
import { emojisFilter } from "./filters/emojis.js"
import { membersEvents } from "./events.js"
import { randomComponents, toolsCommands } from "./commands/tools.js"
import { stormComponents } from "./commands/storm.js"
import { funCommands } from "./commands/fun.js"

export default defineModule({
  translation,
  events: membersEvents,
  components: {
    ...randomComponents,
    ...stormComponents,
  },
  filters: [
    ...reactionFilters,
    pollFilter,
    emojisFilter,
    findingsFilter,
    vulgarismsFilter,
  ],
  commands: {
    fun: group({
      description: `Polecenia czysto rozrywkowe, generujące nawet i dziwne rzeczy`,
      commands: funCommands,
    }),
    ...toolsCommands,
  },
})
