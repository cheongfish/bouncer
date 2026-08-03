'use strict';

const js = require('@eslint/js');

// The rules below encode the style the codebase already uses, so the linter
// enforces what reviewers were checking by hand. Vendored third-party code is
// not ours to restyle. `scripts/lib/**` is tsc emit (4-space printer); style is
// enforced on hand-written JS elsewhere. TS sources under scripts/src need a
// typescript-eslint config before they can be linted.
module.exports = [
  {
    ignores: [
      'scripts/vendor/**',
      'scripts/lib/**',
      'node_modules/**',
      'graphify-out/**',
      'docs/**',
    ],
  },
  js.configs.recommended,
  {
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'commonjs',
      globals: {
        module: 'writable',
        require: 'readonly',
        process: 'readonly',
        console: 'readonly',
        __dirname: 'readonly',
        Buffer: 'readonly',
      },
    },
    linterOptions: {
      reportUnusedDisableDirectives: true,
    },
    rules: {
      indent: ['error', 2, { SwitchCase: 1 }],
      quotes: ['error', 'single', { avoidEscape: true }],
      semi: ['error', 'always'],
      'comma-dangle': ['error', 'always-multiline'],
      'max-len': ['error', { code: 120, ignoreUrls: true, ignoreRegExpLiterals: true }],
      'object-curly-spacing': ['error', 'always'],
      'arrow-parens': ['error', 'always'],
      eqeqeq: ['error', 'always', { null: 'ignore' }],
      'prefer-const': 'error',
      'no-var': 'error',
      strict: ['error', 'global'],
      // Unused catch bindings are named `_e` by convention throughout.
      'no-unused-vars': ['error', { caughtErrorsIgnorePattern: '^_' }],
    },
  },
];
