---
distill:
  id: build-ts
  paths:
    - scripts/src/**
    - scripts/lib/**
    - tsconfig.json
  pulls: []
---
# build-ts

## Invariants

- Plugin consumers stay Node-only: commit `scripts/lib` CJS emit; regenerate via `pretest` / `npm run build`; no TS runtime at consume time. `tsc` does not rewrite `require('../vendor/...')` - keep `outDir`/`rootDir` so emit lands in `scripts/lib` and relative vendor paths stay valid. Core splits stay flat under `scripts/src/lib` - nesting breaks emit-relative vendor requires.

## Gotchas

- Plain CJS without `import`/`export` needs `moduleDetection: force` or files collide as scripts.
- Runtime `scripts/vendor/*` must stay byte-identical to the installed package. `npm audit` misses vendor copies - clean lockfile alone is not enough.
- Coverage floor on `scripts/lib/**` only (exclude vendor/tests): lines 94%, branches 82%, functions 96% (1pp branch buffer for CI/local drift).

## Decisions

- Default `tsconfig.json` is `strict: true` for all `scripts/src`; do not reintroduce `tsconfig.strict.json`.
- `npm run ci` is the single local/CI entry (`check:emit` -> `test:coverage` -> `lint` -> `typecheck` -> `npm audit --audit-level=high`). GHA and GitLab run only that after `npm ci`.
