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

Rules routed to build-ts; routing remains disabled until the project explicitly opts in.

## Invariants

- Plugin consumers stay Node-only: commit `scripts/lib` CJS emit and regenerate
  via `pretest` / `npm run build`; do not require TS runtimes at consume time.
  `tsc` does not rewrite `require('../vendor/…')` — keep `outDir`/`rootDir` so
  emit lands in `scripts/lib` and relative vendor paths stay valid. Core splits
  stay flat siblings under `scripts/src/lib` for the same reason — a nested
  folder would break emit-relative vendor requires.

## Gotchas

- Plain CJS without `import`/`export` needs `moduleDetection: force` or files
  collide as scripts across the program.

- Runtime `scripts/vendor/*` must stay byte-identical to the installed package
  file. `npm audit` does not see vendor copies, so a clean lockfile alone is
  not enough.

- Coverage floor uses Node built-in coverage on `scripts/lib/**` only (exclude
  vendor/tests): lines 94%, branches 83%, functions 96%.

## Decisions

- Default `tsconfig.json` is `strict: true` for all `scripts/src` TypeScript;
  do not reintroduce a temporary `tsconfig.strict.json` migration overlay.

- `npm run ci` is the single local/CI entry (`check:emit` → `test:coverage` →
  `lint` → `typecheck` → `npm audit --audit-level=high`). GitHub Actions and
  GitLab CI run only that after `npm ci`.
