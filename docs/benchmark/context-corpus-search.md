# Context corpus search regression

Fixed queries `epic-018`, `epic-007`, and `epic-060` pin recall of each canonical epic index and cap candidate growth after corpus consolidation.

## Fixture

- Path: `test/fixtures/context-corpus-queries.json`
- Search method: `epic-id-path-prefix` (markdown under `.bouncer/context/epics/NNN-*`)
- Required hits: final canonical epic `index.md` paths (English ASCII)
- `max_candidates`: pre-compression baseline; growth fails the suite
  - `epic-018`: 144 (already consolidated tree size)
  - `epic-007`: 96 (post-task-004 consolidation under `007-project-distill`)
  - `epic-060`: 91 (pre-compression union of scattered graph/search parents)

## Commands

```bash
node --test test/context-corpus-search.test.js
npm test
```

## Hierarchy under test (task 003)

- Canonical epic: `060-graphify-search-quality`
- Retained: `blueprints/001-context-first-ranking`
- Migrated: `002-silent-skip-signal` … `008-scope-separation-and-reporting`
- Removed parents: `011, 026, 040, 062, 063, 064`

## Hierarchy under test (task 004)

- Canonical epic: `007-project-distill`
- Retained: `001-global-distill-runtime`, `002-project-root-distill`
- Migrated: `003-path-routed-distill` … `009-master-distill-compaction`
- Removed parents: `036, 037, 038, 047, 055, 058`
