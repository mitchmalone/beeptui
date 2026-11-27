import tseslint from 'typescript-eslint'
import reactHooks from 'eslint-plugin-react-hooks'
import prettier from 'eslint-config-prettier'
import globals from 'globals'

export default tseslint.config(
  // apps/www lints itself with eslint-config-next (see its eslint.config.mjs);
  // the root `lint` script chains it.
  { ignores: ['**/node_modules/**', 'coverage/**', '**/dist/**', 'apps/www/**'] },
  ...tseslint.configs.recommended,
  {
    files: ['**/*.{ts,tsx}'],
    languageOptions: {
      globals: { ...globals.node },
    },
    plugins: { 'react-hooks': reactHooks },
    rules: {
      'react-hooks/rules-of-hooks': 'error',
      'react-hooks/exhaustive-deps': 'warn',
    },
  },
  {
    files: ['scripts/**/*.mjs'],
    // Node scripts, not app code (scripts/session.mjs is jig-owned).
    languageOptions: { globals: { ...globals.node } },
    rules: { 'no-console': 'off' },
  },
  // Disable stylistic rules that conflict with Prettier — Prettier owns formatting.
  prettier
)
