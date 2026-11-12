import eyeConfig from "eslint-config-eye"
import { defineConfig, globalIgnores } from "eslint/config"

export default defineConfig([
  ...eyeConfig,
  globalIgnores([ `dist/**`, `uploader/**`, `presentation/**` ]),

  // The core and the entry stay communicator-agnostic: only a communicator's own folder imports its SDK
  {
    files: [ `index.ts`, `src/**/*.ts` ],
    ignores: [ `src/discord/**` ],
    rules: {
      "no-restricted-imports": [ `error`, {
        patterns: [ { regex:`^(discord\\.js|@discordjs/.*)$`, message:`Discord code belongs in src/discord/.` } ],
      } ],
    },
  },
])
