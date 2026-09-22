# Document schema

Target OKF spec version: **0.1**, declared in the bundle-root
`.bouncer/context/index.md` frontmatter. That is the one place OKF §11 permits it.

The same bundle-root frontmatter also carries `bouncer_schema: "0.1"`. That
value is Bouncer's document-schema promise (what `bouncer.*` kinds and fields
mean), not the OKF package version. Keep it only on the bundle root — putting
it on every epic/blueprint/task document would drift. The string stays
`"0.1"` until a later epic promotes the schema; this cutover does not bump it
to `1.0`.

Every `context/**/*.md` document carries OKF frontmatter
(`type`, `title`, `description`, `resource`, `tags`, `timestamp`); Bouncer
fields live under `bouncer:`. See the schema-gates design for the full schema.

## Frontmatter authorship and meaning

Frontmatter is an index for people and agents before they read the document
body. It must be grounded in the source, approved task scope, or harness
output; do not use it to make an unverified completion claim.

**Harness-owned fields.** Scaffold owns `type`, `resource`, `timestamp`, and
`bouncer.id` (including parent ids). Keep them mechanically correct: `resource`
is the repository-relative path to this file, and do not hand-edit an id or
timestamp to make a document look newer. The workflow owns `bouncer.status`
transitions and verification metadata. Only the workflow step that produces
the relevant evidence may record a passed or accepted state.

**Author-written discovery fields.** Use `title`, `description`, and `tags` to
make the document findable without duplicating its body:

For new or modified documents, keep `title` Korean: `.gitmessage` uses it as
the nominal commit-title source, so do not translate it. Write `description`
and `tags` in English ASCII. This does not call for tokenizer or
Korean-search support or a bulk rewrite of the existing corpus.

- `title` states the durable intent or decision in a short noun phrase. It is
  not an id, a file name, or a claim that the work has completed.
- `description` is one present-tense sentence saying what the document covers
  and why it matters. State the boundary or observable behavior, not an
  implementation sequence or an unverified result.
- Epic frontmatter `description` is the human-authored source of truth for its
  bundle index summary. The summary row is derived by `scaffold epic` and may
  be appended or replaced, while S13 reports a mismatch; the row is not an
  authoring surface.
- `tags` are the domain search vocabulary that people and `graph-suggest`
  queries use. Each item is an English ASCII single token matching
  `[A-Za-z0-9_./-]`. Keep the scaffold's `bouncer` and document-kind tag;
  add 2–5 durable domain tags (for example `worktree`, `intent`, or
  `graph-suggest`). Do not add temporary
  ticket ids, one-off filenames, or synonyms for the same concept.

**Plan fields.** `bouncer.affected_paths` is the minimum approved set of
repository-relative paths that may change. Every entry must be justified by a
file-level `Touch` item; it is not a search-result dump or a future-work list.
When `bouncer.verify` is present, it is one executable command that proves the
task's acceptance criteria, not prose such as "run tests." Blueprint
`bouncer.commit_type` describes the intended commit category and
`bouncer.scale` describes the approved planning path; neither is changed
merely to make an implementation easier to fit. Epic and blueprint
`bouncer.supersedes` lists document paths this one replaces; validation checks
shape only (absent or an array of non-empty strings), not referential integrity.
`graph-suggest` candidates and `bouncer intent` results are advisory input; do
not store them in frontmatter. No code reads leftover `bouncer.scope_evidence`
or `bouncer.graph` on older task documents.

Task DAG fields are author-written on `bouncer.tasks` only. Task numbers are
display and default sort order — not execution authority.

- `bouncer.execution_kind` is `commit` or `verification`; absent reads as
  `commit`. A verification node requires non-empty `depends_on`, explicit
  `parallel_safe: false`, `dependency_gate: integrated`, an executable
  `bouncer.verify`, and empty `affected_paths`. It may feed only another
  verification node, so implementation scope cannot be placed behind it. Its
  task status closes as `ready → verifying → integrated`; it has no review
  document or commit SHA.

- `bouncer.depends_on` is an array of `TASKS-NNN` ids this task waits on.
  Absent or `[]` means no dependencies (legacy plans stay valid). Structural
  validation (S28) checks shape; the plan gate (G19) checks missing ids,
  self-references, duplicates, and cycles across the blueprint's task set.
- `bouncer.parallel_safe` is a boolean. `false` or absent means the task is
  sequential wave input; `true` means it may share a ready wave with other
  parallel-safe peers once dependencies clear.
- `bouncer.dependency_gate` is `integrated`, the only accepted value. Absent
  reads as `integrated`: the successor opens when each predecessor reaches that
  integration state.

- `bouncer.review_risk` is an optional array of unique values from
  `public_interface | authentication | authorization | credential`. Plan
  authoring owns the field: when Interface or Touch names a public API,
  authentication, authorization, or credential change, record every matching
  enum; when none of those risks apply, write `[]` explicitly on new documents.
  Absent on legacy tasks reads as `[]` for dispatch compatibility; malformed
  shape, unknown values, and duplicates fail structural validation as `S30`.
  The field only widens Execute reviewer fan-out — it never auto-approves
  `affected_paths`, document status, or a gate.

Task `bouncer.commit_intent` and `bouncer.commit_summary` are optional authored
lists of 1–2 Korean terminal sentences. `/bouncer-commit` renders present
fields in that order and rejects malformed values without partial omission;
missing fields keep older task documents readable. `/bouncer-finalize` renders
1–2 Korean terminal sentences parsed from the blueprint `## Intent` section and
rejects an absent or malformed section. Authored intent and summary may name
identifiers, paths, and packages inside a Korean terminal sentence; the check
covers only line count, Korean text, and the Korean terminal ending. Keep Epic /
Blueprint ids out of them, and do not add dependencies or trailers.

**Generated evidence fields.** verification, review,
context-review, comprehension metadata, `bouncer.commit_sha` (tasks, 8-char
hex written by commit), and `bouncer.task_commits` (explain, copied at finalize
as `{ task, sha, intent_anchor }`)
record their respective workflow evidence. Treat all of them as data produced by
their designated step. Do not manufacture values to satisfy a gate; correct the
plan, rerun the designated step, or return to planning.

## Task bundle and commit records

A task unit is the three-document bundle
`tasks/<NNN>/{tasks,verification,review}.md`; each file has its own OKF
frontmatter and `resource` path. Root task layouts are input only to
`bouncer migrate task-layout`. Blueprint-root documents sit beside that
bundle: `explain.md` (written at finalize) and `context-review.md` (plan
document consistency). After finalize deletes task leaves, `explain.md`
`bouncer.task_commits` writes `{ task, sha, intent_anchor }` rows:
`task` is `EPIC-<ddd>/BP-<ddd>/TASK-<ddd>`, `intent_anchor` is `task-<ddd>`,
and `sha` stays 8-char hex. Existing explain documents are not rewritten until
finalize writes them again.

Task commit staging excludes the task bundle and context documents even when
shared scope authorization allows those workflow paths. Finalize owns their
lifecycle: it preserves `explain.md` and Blueprint `index.md` while deleting
one-off task evidence and optional context review.

Harness-written timestamps use **KST** (`Asia/Seoul`, offset `+09:00`), e.g.
`2026-08-03T18:00:00.000+09:00`. Pass `--timestamp` to override when scaffolding.

Known divergence from OKF v0.1: epic and blueprint concept documents are named
`index.md`, which §3.1 reserves for directory listings, so the bundle is not
yet §9-conformant. Tracked separately from template authoring.
