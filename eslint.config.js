import js from '@eslint/js'
import pluginVue from 'eslint-plugin-vue'
import globals from 'globals'

import autoImports from './.eslintrc-auto-import.json' with { type: 'json' }

export default [
  {
    name: 'app/files-to-lint',
    files: ['**/*.{js,mjs,jsx,vue}'],
  },

  {
    // The app runs in a browser, so window, document, fetch, localStorage and
    // the rest are defined. Without this every use of them is a no-undef error.
    //
    // unplugin-auto-import writes .eslintrc-auto-import.json on every dev run
    // and build; it lists what the plugin injects (ref, computed, useRoute, …)
    // so those do not read as undefined either.
    name: 'app/browser-globals',
    languageOptions: {
      globals: {
        ...globals.browser,
        ...autoImports.globals,
        // Injected by Vite's define (see vite.config.mjs).
        __APP_VERSION__: 'readonly',
      },
    },
  },

  {
    name: 'app/files-to-ignore',
    ignores: ['**/dist/**', '**/dist-ssr/**', '**/coverage/**'],
  },

  js.configs.recommended,
  ...pluginVue.configs['flat/recommended'],

  {
    rules: {
      'vue/multi-word-component-names': 'off',
    },
  }
]
