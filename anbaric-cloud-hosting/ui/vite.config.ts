import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { viteSingleFile } from 'vite-plugin-singlefile'

// The platform's served pages (authorize-cli and manage-keys), built as one
// self-contained HTML file that the Router serves for both routes; the app
// picks its page from location.pathname. Output lands inside the hosting
// package's source so it ships with the platform.
export default defineConfig({
  plugins: [react(), viteSingleFile()],
  base: './',
  resolve: {
    dedupe: ['react', 'react-dom'],
  },
  build: {
    cssTarget: 'safari18',
    outDir: '../src/hosting/pages',
    emptyOutDir: false,
    assetsInlineLimit: 100_000_000,
    rollupOptions: {
      input: 'platform-ui.html',
    },
  },
  server: { port: 5191, strictPort: true },
})
