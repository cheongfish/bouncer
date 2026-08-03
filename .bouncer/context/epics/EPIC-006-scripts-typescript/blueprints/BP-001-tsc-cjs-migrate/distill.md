---
type: bouncer.distill
title: BP-001 distill
description: Distill for BP-001
resource: .bouncer/context/epics/EPIC-006-scripts-typescript/blueprints/BP-001-tsc-cjs-migrate/distill.md
tags:
  - bouncer
  - distill
timestamp: '2026-08-03T04:04:55.505Z'
bouncer:
  id: DISTILL-BP-001
  epic_id: EPIC-006
  blueprint_id: BP-001
  status: published
---
# Distill

## Durable learnings

- **Emit path must match require strings.** `tsc` does not rewrite
  `require('../vendor/…')`. With sources under `scripts/src/lib` and
  `outDir`/`rootDir` pair that emits to `scripts/lib`, vendor requires stay
  correct at runtime; typecheck needs a local cast (or shim), not a different
  relative path in source.
- **CJS files need `moduleDetection: force`.** Plain `require`/`module.exports`
  without `import`/`export` are treated as scripts and collide across files
  until every file is forced into module scope.
- **Committed emit + `pretest` build** keeps plugin consumers on Node-only
  while CI still regenerates `scripts/lib` before tests.
- **Name-policy scanners see new source paths.** After tracking
  `scripts/src/**/*.ts`, legacy/`superpowers` allowlists that only listed
  `scripts/lib/*.js` (or negative-test files with contiguous literals) fail
  until those paths/literals are updated. Plan for scanner allowlists when
  adding a parallel source tree.
- **Mechanical TS migration can start with `strict: false`** plus a few
  `Record<string, …>` annotations on empty objects; tightening strictness is a
  follow-up, not a blocker for CJS parity.
