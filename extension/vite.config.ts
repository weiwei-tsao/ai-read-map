import { defineConfig } from 'vite'
import { crx } from '@crxjs/vite-plugin'
import manifest from './src/manifest'

export default defineConfig({
  plugins: [crx({ manifest })],
  build: {
    rollupOptions: {
      input: {
        content: 'src/content/index.ts',
      },
      output: {
        entryFileNames: (chunk) => (chunk.name === 'content' ? 'content.js' : 'assets/[name]-[hash].js'),
      },
    },
  },
})
