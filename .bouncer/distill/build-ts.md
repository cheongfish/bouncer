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

## Decisions

- Mechanical TS migration may keep `strict: false` until a later tightening BP.

