'use strict';

const js = require('@eslint/js');
const tseslint = require('typescript-eslint');

// The rules below encode the style the codebase already uses, so the linter
// enforces what reviewers were checking by hand. Vendored third-party code is
// not ours to restyle. `scripts/lib/**` is tsc emit (4-space printer); style is
// enforced on hand-written JS elsewhere. TypeScript lint is opened only for the
// first strict module group; later commits expand this list with the same
// recommended surface.
const STRICT_TS_FILES = [
  'scripts/src/lib/config.ts',
  'scripts/src/lib/frontmatter.ts',
  'scripts/src/lib/render.ts',
  'scripts/src/lib/time.ts',
  'scripts/src/lib/templates.ts',
  'scripts/src/lib/tasks-docs.ts',
  'scripts/src/lib/paths.ts',
  'scripts/src/lib/layout.ts',
  'scripts/src/lib/scope.ts',
  'scripts/src/lib/subagents.ts',
  'scripts/src/lib/epic-index.ts',
  'scripts/src/lib/scaffold.ts',
  'scripts/src/lib/verification.ts',
  'scripts/src/lib/validate-sections.ts',
  'scripts/src/lib/validate-docs.ts',
  'scripts/src/lib/validate-structural.ts',
  'scripts/src/lib/validate-gates.ts',
  'scripts/src/lib/validate.ts',
  'scripts/src/lib/runtime-state.ts',
  'scripts/src/lib/current.ts',
  'scripts/src/lib/commit-hook.ts',
  'scripts/src/lib/commit-guard.ts',
  'scripts/src/lib/commit.ts',
  'scripts/src/lib/finalize.ts',
  'scripts/src/lib/seed-worktree.ts',
  'scripts/src/lib/comprehension.ts',
  'scripts/src/lib/migrate-ids.ts',
  'scripts/src/lib/migrate-task-layout.ts',
];

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
  ...tseslint.configs.recommended.map((conf) => ({
    ...conf,
    files: STRICT_TS_FILES,
  })),
  {
    files: STRICT_TS_FILES,
    languageOptions: {
      parser: tseslint.parser,
      parserOptions: {
        project: './tsconfig.strict.json',
      },
    },
    rules: {
      // 타입 이름은 값이 아니므로 core no-undef가 오탐한다. 미정의 값은 tsc가 잡는다.
      'no-undef': 'off',
      // core no-unused-vars는 타입 위치 식별자를 모른다. TS 규칙을 같은 _ 관례로 둔다.
      'no-unused-vars': 'off',
      '@typescript-eslint/no-unused-vars': ['error', {
        caughtErrorsIgnorePattern: '^_',
        varsIgnorePattern: '^_',
        ignoreRestSiblings: true,
      }],
      // recommended는 ESM import를 전제한다. 이 저장소 런타임은 CJS require이며
      // tsc가 require 문자열을 재작성하지 않으므로 그 한 규칙만 끈다.
      '@typescript-eslint/no-require-imports': 'off',
      // parser가 TS를 module로 보면 'use strict'가 불필요해진다. 지시문을 지우면
      // CJS emit에 'use strict'가 빠져 공개 런타임과 달라지므로 규칙만 끈다.
      strict: 'off',
    },
  },
];
