import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import tseslint from 'typescript-eslint'
import { defineConfig, globalIgnores } from 'eslint/config'

export default defineConfig([
  globalIgnores(['dist', '.claude', '.vercel', 'node_modules', '_local-nao-versionado']),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      js.configs.recommended,
      tseslint.configs.recommended,
      reactHooks.configs.flat.recommended,
      reactRefresh.configs.vite,
    ],
    languageOptions: {
      ecmaVersion: 2020,
      globals: globals.browser,
    },
    rules: {
      // `_algo` = descarte deliberado. Aparece ao tirar campo sensível de um objeto
      // (`const { storage_path: _p, ...safe } = row`), onde a variável existe só para
      // o resto não levar o campo junto.
      '@typescript-eslint/no-unused-vars': ['error', {
        varsIgnorePattern: '^_',
        argsIgnorePattern: '^_',
        caughtErrorsIgnorePattern: '^_',
        destructuredArrayIgnorePattern: '^_',
      }],
    },
  },
  {
    // DEBT-02: estes três co-locam o hook com o componente que ele controla, de propósito —
    // `useConfirmDialog` devolve o próprio `<ConfirmDialog>` já montado, e `Field` é a fonte
    // única da aparência dos controles (FE-24). Separar em outro arquivo só para agradar o
    // fast refresh mexeria em 41 arquivos de importação e quebraria essa unidade. O preço é
    // recarregar a página inteira ao editar um destes três em desenvolvimento.
    files: [
      'src/components/ui/Field.tsx',
      'src/components/ui/ConfirmDialog.tsx',
      'src/components/client/PortalActionPlan.tsx',
    ],
    rules: { 'react-refresh/only-export-components': 'off' },
  },
])
