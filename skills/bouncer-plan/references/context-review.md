When deciding context review for a `scale: full` blueprint after `affected_paths` confirmation, read this reference.

**Plugin-root shell contract.** See `rules/plugin-root.md`. Apply the shared
model and host-fallback order in [`rules/subagent-model.md`](../../../rules/subagent-model.md).

Before approval, judge the plan documents. The `context-review` skill (`references/context-review/index.md`) is the behavioral brief. Dispatch **`bouncer-context-reviewer`** (plugin `agents/bouncer-context-reviewer.md`) with the resolved model, passing the epic `index.md`, the blueprint `index.md`, and every `tasks/<NNN>/tasks.md` under the blueprint as the documents under judgment. Compose that prompt inline (no `assets/` template — the paths are already known). Ask for a Findings list only.

If named agents are unavailable, run the `context-review` skill inline (or use a
fresh generic read-only subagent with the same brief). Do **not** skip this
step.

As controller, update existing blueprint-root `context-review.md` body `## Findings` and `bouncer.context_review.findings[]` from the reviewer output — the subagent must not edit documents or flip status. An `accepted` finding requires a note. Only when every finding is `resolved` or `accepted` with a note, set `context-review → accepted`.

When recording finding `note` (and any other author-written frontmatter
scalar on that document), apply the same YAML leading-character quoting
rule as `spec-authoring` (`references/spec-authoring/index.md`
`## Author-written frontmatter scalars`): if the value starts with a YAML
예약 지시자 such as a leading 백틱, write it as a 작은따옴표 scalar or a
block scalar (`>-` / `|`) — never as plain text after `- `. A mid-string
or Markdown-본문 backtick is out of scope for this rule.
