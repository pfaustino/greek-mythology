import { defineConfig } from 'vite'
import { edgeTtsPlugin } from './scripts/vite-edge-tts.ts'

export default defineConfig(({ command }) => ({
  base: command === 'serve' ? '/' : '/greek-mythology/',
  plugins: [edgeTtsPlugin()],
}))
