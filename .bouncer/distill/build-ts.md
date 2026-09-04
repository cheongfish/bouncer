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

- Plugin consumers stay Node-only: commit `scripts/lib` CJS emit; no TS runtime at consume time. Keep splits flat under `scripts/src/lib` — nesting breaks emit-relative vendor requires.

## Gotchas

- Runtime `scripts/vendor/*` must stay byte-identical to the installed package. `npm audit` misses vendor copies.

## Decisions

- Default `tsconfig.json` is `strict: true` for all `scripts/src`; do not reintroduce `tsconfig.strict.json`.
