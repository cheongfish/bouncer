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

- Graph freshness/config/dir reads live in `graph-scope.ts` (filesystem only; do not require `graphify.ts`). Process execution lives in `graph-exec.ts`.
- Graphify bin resolution is `config.graphify.bin` -> `.bouncer/.venv` -> PATH via sole resolver `resolveGraphifyBin` in `scripts/src/lib/graphify.ts` (CLI: `bouncer graphify-bin`). A `.bouncer/.venv` dir without the platform binary is not a hit - skip to PATH. Skills/SessionStart must not invoke `graphify` by bare name; `graphify-runner` takes the binary only from `bouncer graphify-bin` and runs `"$GRAPHIFY_BIN" query ...`, treating empty/failed bin as graceful skip.
- Context graph builds from section-digest tree at `graphify-out/context-src/` (whitelist headings only), not full `context_dirs` bodies: `buildContextDigest` writes that tree plus `map.json` (sole remap SSOT) and `defaultExecGraphify` remaps with `normalizeGraphPaths(..., { map })` so consumers/`suggested_paths` see original repo paths only.
- Context freshness uses `dirs` + `watchFiles` (originals only). Derived tree is not a freshness input - freshness walk prunes `graphify-out`, so derivatives cannot mark themselves stale.

## Gotchas

- `graphSyncWarnings` missing copy: "none of ... exist" only for `skip-no-dirs` / empty `dirs`; scopes already in `failed` must not get a missing line.
- `newestMtimeUnder` skips dirs named `graphify-out`, `node_modules`, `.git`, `.worktrees` and does not descend directory symlinks.
- Graphify venv install failures (missing python3, pip/mirror block, `graphify install` error) are soft-ok: warn, leave `enabled: false`, init still exits 0.
- Unmapped digest nodes (no `map.json` entry) drop with links/hyperedges that pointed at them - never leave a derived basename as `source_file`. Empty digest skips the graphify call for that scope; do not scan empty `context-src` and overwrite a prior graph with emptiness.
- `graphify-runner` drops hits under `graphify-out/` before directory rollup and must not read `map.json` to translate derived names - remap belongs to the build path only.
- `.bouncer/Distill.md` sits outside `context_dirs`, so context `watchFiles` must include it or Distill-only edits leave the graph stale.

## Decisions

- Graph absence is a state, not an error: `syncSessionGraphs.missing` stays empty on `NO_GRAPH_WORK` paths and never flips `ok` to false; consumers signal via fields/stderr, not exit codes.
- init default `source_dirs` is the fixed candidate list filtered to existing directories (order preserved); empty -> `[]` with `sourceDirsUnresolved`. Existing `config.json` is not changed without consent. `--promote-graphify` alone may change `graphify.enabled` (and `bin` when install succeeds). Library `init()` defaults to no Graphify install; `cmdInit` opts in. `/bouncer-init` reports install outcome and uses ACQ for promotion and gitignore write - must not hand-edit `config.json` for `enabled`.
