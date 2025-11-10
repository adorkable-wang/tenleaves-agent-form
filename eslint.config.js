import path from 'node:path'
import { fileURLToPath } from 'node:url'
import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import tseslint from 'typescript-eslint'
import { defineConfig, globalIgnores } from 'eslint/config'

const tsconfigRootDir = path.dirname(fileURLToPath(import.meta.url))
const tsProjectConfigs = [
  './tsconfig.app.json',
  './tsconfig.node.json',
  './tsconfig.lib.json',
]

export default defineConfig([
  globalIgnores(['dist', 'dist-lib']),
  {
    files: ['src/**/*.{ts,tsx}'],
    extends: [
      js.configs.recommended,
      ...tseslint.configs.recommendedTypeChecked,
      reactHooks.configs['recommended-latest'],
      reactRefresh.configs.vite,
    ],
    languageOptions: {
      ecmaVersion: 2020,
      globals: globals.browser,
      parserOptions: {
        project: tsProjectConfigs,
        tsconfigRootDir,
      },
    },
  },
  {
    files: [
      'server/**/*.ts',
      'uno.config.ts',
      'vite.config.ts',
      'vite.lib.config.ts',
      'eslint.config.js',
    ],
    extends: [
      js.configs.recommended,
      tseslint.configs.recommended,
    ],
    languageOptions: {
      ecmaVersion: 2020,
      globals: {
        ...globals.browser,
        ...globals.node,
      },
      parserOptions: {
        project: null,
      },
    },
  },
])
