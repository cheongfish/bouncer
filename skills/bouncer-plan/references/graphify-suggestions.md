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

Compose `--query` and `--seed`, and decide whether to run `--debug` or a
shrink retry, only by following the Rank step in `graphify-runner`
(`${BOUNCER_ROOT}/references/graphify-runner/index.md`). Do not duplicate those
limits here.

Suggestions never write or modify `affected_paths` automatically — show role
candidates and quality reasons first, then confirm paths with the user.
