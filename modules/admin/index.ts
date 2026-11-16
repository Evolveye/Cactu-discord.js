/* Server administration: module management and speaking through the bot. Everything is under `$` for administrators. */

import { command, defineModule, group } from "cactu-discord.js"
import { modulesGroup } from "./commands/modules.js"
import { messagesCommands } from "./commands/messages.js"
import { evalCommand } from "./commands/eval.js"

export default defineModule({
  commands: {
    nobody: command({ perms:`_NOBODY`, run:() => undefined }),

    $: group({
      description: `Umiejętności mistycznego oka`,
      perms: `_ADMIN`,
      commands: {
        modules: modulesGroup,
        ...messagesCommands,
        eval: evalCommand,
      },
    }),
  },
})
