When generating Graphify suggestions, read this reference.

After authoring, use `bouncer graph-suggest` for file-path ranking only when a
**source** graph is available (and optionally **test**). Show the stdout
candidates and `quality` / `reasons` before step 4 confirmation. Do not sync
or directly query a context graph, and do not write suggestion output into
task frontmatter. If Graphify is unavailable or source is missing, leave the
advisory list empty, tell the user how to enable Graphify (`bouncer init` for
a fresh bootstrap, or `bouncer init --promote-graphify` on an existing project —
same path graphify-runner prints; do not edit `config.json` by hand), and say
so so the user can seed paths manually. On `low-confidence`, keep role
candidates for review but treat the narrower path list as empty.

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

Suggestions never write or modify `affected_paths` automatically — show role
candidates and quality reasons first, then confirm paths with the user.
