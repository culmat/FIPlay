// Plugins
import AutoImport from 'unplugin-auto-import/vite'
import Components from 'unplugin-vue-components/vite'
import Vue from '@vitejs/plugin-vue'
import VueRouter from 'unplugin-vue-router/vite'

// Utilities
import { defineConfig } from 'vite'
import { fileURLToPath, URL } from 'node:url'
import { copyFileSync, existsSync } from 'node:fs'
import { resolve } from 'node:path'

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
  define: { 'process.env': {} },
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
