---
distill:
  id: graph
  paths:
    - scripts/src/lib/graph*.ts
    - scripts/src/lib/context-digest.ts
  pulls: []
---
# graph

## Invariants

- Graphify bin resolution is `config.graphify.bin` -> `.bouncer/.venv` -> PATH via `bouncer graphify-bin` only; never invoke bare `graphify`. Empty/failed bin is a graceful skip.
- Context graph builds from section-digest at `graphify-out/context-src/` plus `map.json` (remap SSOT). Freshness uses originals only — derived tree is not a freshness input.

## Gotchas

- Graphify venv install failures are soft-ok: warn, leave `enabled: false`, init still exits 0.
- Empty digest must not overwrite a prior graph; unmapped nodes drop — never leave a derived basename as `source_file`.
- `.bouncer/Distill.md` sits outside `context_dirs`; include it in context `watchFiles` or Distill-only edits leave the graph stale.

## Decisions

- Graph absence is a state, not an error — signal via fields/stderr, not exit codes.
- Do not hand-edit `config.json` for `graphify.enabled`; use `/bouncer-init` ACQ or `--promote-graphify`.
