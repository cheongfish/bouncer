When generating Graphify suggestions, read this reference.

Use the `graphify-runner` skill (`references/graphify-runner/index.md`) to run
`bouncer graph-sync` (plan-time freshness for **source** + **test** + **context**
graphs), then `bouncer graph-suggest`, and write structured
`bouncer.scope_evidence` into each `tasks/<NNN>/tasks.md` under the blueprint:
`suggested_paths` (file paths only), paired `quality` + role `candidates`, and a
non-empty `basis` entry list for source·test·context. If graphify is unavailable,
it leaves `suggested_paths` empty, records `quality.status: unavailable` with
reasons, empty role candidates, and a graceful fallback `basis` with
`producer: graphify` (per-graph `status` such as `skip-disabled` / `missing`),
tells the user how to enable Graphify (`bouncer init` for a fresh bootstrap, or
`bouncer init --promote-graphify` on an existing project — same path
graphify-runner prints; do not edit `config.json` by hand), and says so so the
user can seed paths manually. On `low-confidence`, keep role candidates for
review but leave `suggested_paths` empty.

When composing the plan-time `--query` and `--seed` values, shrink the search
space the same way graphify-runner does:

1. **No hubs / generic words** — skip CLI hubs (`scripts/bouncer`) and vague
   nouns that flood the graph; prefer concrete domain nouns from the blueprint.
2. **1–2 entry symbols** — seed only the real entry files or symbols of the
   change (ASCII paths, function names, anchors).
3. **Deletion targets as seeds** — if the plan deletes files, seed those paths
   directly so dependent neighbors still rank.
4. **User confirmation** — Graphify candidates are advisory; write
   `affected_paths` only after the user confirms.

Scaffold leaves `basis` as an empty list on purpose, so this step must run: G4
fails until a real non-empty basis entry array is recorded. Existing
`bouncer.graph` and evidence without `quality`/`candidates` are read only for
legacy compatibility and are never a new authoring target. Suggestions never
write or modify `affected_paths` automatically — show role candidates and
quality reasons first, then confirm paths with the user.
