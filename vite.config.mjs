// Plugins
import AutoImport from 'unplugin-auto-import/vite'
import Components from 'unplugin-vue-components/vite'
import Vue from '@vitejs/plugin-vue'
import VueRouter from 'unplugin-vue-router/vite'
import { VitePWA } from 'vite-plugin-pwa'

// Utilities
import { defineConfig } from 'vite'
import { fileURLToPath, URL } from 'node:url'
import { copyFileSync, existsSync } from 'node:fs'
import { execSync } from 'node:child_process'
import { resolve } from 'node:path'

// The short commit of the code being built, shown in the About dialog. That
// is the only reliable way to tell which version a phone is actually running
// once a service worker sits between it and the server.
const buildVersion = (() => {
  try {
    const hash = execSync('git rev-parse --short HEAD', { stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim()
    const dirty = execSync('git status --porcelain', { stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim() !== ''
    return dirty ? `${hash}-dirty` : hash
  } catch {
    return 'dev'
  }
})()

// Static hosts serve 404.html for paths they do not have. Making it the app
// lets /station/<name> survive a reload on GitHub Pages, which offers no
// other way to route unknown paths back to the page.
const spaFallback = () => ({
  name: 'spa-404-fallback',
  apply: 'build',
  closeBundle () {
    const dir = fileURLToPath(new URL('./dist/FIPlay', import.meta.url))
    const index = resolve(dir, 'index.html')
    if (existsSync(index)) copyFileSync(index, resolve(dir, '404.html'))
  },
})

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [
    spaFallback(),
    VueRouter(),
    // A service worker earns its place here for one reason: without one,
    // Firefox and Chrome on Android treat Add to Home Screen as a bookmark and
    // open the site in a tab with the address bar, rather than installing it.
    // The manifest alone is not enough. It also needs a secure origin, so on a
    // plain http LAN address this registers nothing (see the README).
    //
    // Precache only. Every request that matters at runtime (metadata, artwork,
    // the audio stream, the speaker backend) is cross-origin and goes straight
    // to the network, so there are no runtime caching rules to get wrong.
    VitePWA({
      // The manifest is a real file in public/, because `bun run deploy`
      // rewrites its start_url for the NAS.
      manifest: false,
      injectRegister: false,
      registerType: 'prompt',
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg,webmanifest}'],
        navigateFallback: '/FIPlay/index.html',
        // version.json is how a deploy proves what is being served, and the
        // metadata service must never be answered from a cache.
        navigateFallbackDenylist: [/version\.json$/],
        cleanupOutdatedCaches: true,
      },
      devOptions: { enabled: false },
    }),
    Vue(),
    Components(),
    AutoImport({
      imports: [
        'vue',
        'vue-router',
      ],
      eslintrc: {
        enabled: true,
      },
      vueTemplate: true,
    }),
  ],
  define: {
    'process.env': {},
    __APP_VERSION__: JSON.stringify(buildVersion),
  },
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url))
    },
    extensions: [
      '.js',
      '.json',
      '.jsx',
      '.mjs',
      '.ts',
      '.tsx',
      '.vue',
    ],
  },
  server: {
    port: 3000,
  },
  base: '/FIPlay',
  build: {
    outDir: 'dist/FIPlay'
  },
})
