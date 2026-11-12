import eyeConfig from "eslint-config-eye"
import { defineConfig, globalIgnores } from "eslint/config"

export default defineConfig([
  ...eyeConfig,
  globalIgnores([ `dist/**`, `uploader/**`, `presentation/**` ]),
])
