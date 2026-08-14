---
distill:
  id: graph
  paths:
    - scripts/src/lib/graph*.ts
    - scripts/src/lib/context-digest.ts
  pulls: []
---
# graph

Rules routed to graph; routing remains disabled until the project explicitly opts in.

## Invariants

- Graph freshness/config/dir reads live in `graph-scope.ts` (filesystem read
  only; do not require `graphify.ts`). Graphify process execution lives in
  `graph-exec.ts`.

- Graphify executable resolution is `config.graphify.bin` → `.bouncer/.venv` →
  PATH through the single resolver `resolveGraphifyBin` in
  `scripts/src/lib/graphify.ts` (CLI: `bouncer graphify-bin`). A `.bouncer/.venv`
  directory without the platform binary is not a hit — skip that candidate and
  continue to PATH. Skills and SessionStart must not invoke `graphify` by bare
  name; `graphify-runner` takes the binary only from `bouncer graphify-bin` and
  runs `"$GRAPHIFY_BIN" query …`, treating an empty or failed bin as a graceful
  skip rather than a hard plan failure.

- Context graph builds from the section-digest tree at
  `graphify-out/context-src/` (whitelist headings only), not by indexing full
  `context_dirs` bodies: `buildContextDigest` writes that tree plus `map.json`
  (the sole remap SSOT) and `defaultExecGraphify` remaps with
  `normalizeGraphPaths(..., { map })`, so consumers and `suggested_paths` see
  original repo paths only.

- Context scope freshness uses `dirs` + `watchFiles` (originals only). The
  derived tree is not a freshness input — the freshness walk prunes
  `graphify-out`, so derivatives cannot mark themselves stale.

## Gotchas

- `graphSyncWarnings` missing copy: use “none of … exist” only for
  `skip-no-dirs` / empty `dirs`; scopes already in `failed` must not get a
  missing line (failed covers them).

- `newestMtimeUnder` skips directories named `graphify-out`, `node_modules`,
  `.git`, `.worktrees` and does not descend directory symlinks.

- Graphify venv install failures (missing python3, pip/mirror block,
  `graphify install` error) are soft-ok: warn, leave `enabled: false`, and init
  still exits 0.

- Unmapped digest nodes (no `map.json` entry) are dropped together with links
  and hyperedges that pointed at them — never leave a derived basename as
  `source_file`. Empty digest output skips the graphify call for that context
  scope; do not scan an empty `context-src` tree and overwrite a prior graph
  with emptiness.

- `graphify-runner` drops hits under `graphify-out/` before directory rollup and
  must not read `map.json` to translate derived names — remap belongs to the
  build path only.

- `.bouncer/Distill.md` sits outside `context_dirs`, so context `watchFiles`
  must include it or Distill-only edits leave the graph stale.

## Decisions

- Graph absence is a state, not an error: `syncSessionGraphs.missing` stays
  empty on `NO_GRAPH_WORK` paths and never flips `ok` to false; consumers signal
  via fields / stderr, not exit codes.

- init default `source_dirs` is the fixed candidate list filtered to existing
  directories (order preserved); empty yields `[]` with `sourceDirsUnresolved`.
  An existing `config.json` is not changed without consent.
  `--promote-graphify` alone may change `graphify.enabled` (and `bin` when
  install succeeds). Library `init()` defaults to no Graphify install; `cmdInit`
  opts in. `/bouncer-init` reports the install outcome and uses ACQ for
  promotion and the gitignore write — it must not hand-edit `config.json` for
  `enabled`.

