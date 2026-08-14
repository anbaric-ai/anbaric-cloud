import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { viteSingleFile } from 'vite-plugin-singlefile'

// The design-system's own preview / living style guide. index.html is the
// entry; preview/main.tsx mounts the real React components into it.
//
// The build inlines everything — scripts, styles and images — into a single
// dist/index.html, so the built guide opens straight from the filesystem
// (file://) with no server. The components stay real React; only the
// packaging is flattened.
export default defineConfig({
  plugins: [react(), viteSingleFile()],
  base: './',
  build: {
    assetsInlineLimit: 100_000_000,
  },
  server: { port: 5190, strictPort: true },
})
