# OKF

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
and `tags` in English ASCII; derived anchors and search queries use the same
English ASCII contract for graph-suggest. This does not call for tokenizer or
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
- `tags` are the domain search vocabulary that context-digest promotes for
  graph-suggest. Each item is an English ASCII single token matching
  `[A-Za-z0-9_./-]`. Keep the scaffold's `bouncer` and document-kind tag
  (those are not promoted); add 2–5 durable domain tags (for example
  `worktree`, `context-digest`, or `graph-suggest`). Do not add temporary
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

**Scope evidence.** `bouncer.scope_evidence` is the canonical write form for
the candidate paths and basis used to judge a task's scope. It contains
`generated_at`, `producer`, `suggested_paths`, and `basis`; Graphify writes
`producer: graphify`. Optional paired `quality` and `candidates` record
`graph-suggest` status (`ranked` / `low-confidence` / `unavailable`),
confidence, reasons, and role arrays (`implementation` / `test` / `context`).
When either optional field is present, both must be valid; 
`low-confidence` / `unavailable` require empty `suggested_paths`. Basis
`graph` values are `source` | `test` | `context`. `suggested_paths` and role
candidates are advisory evidence, never an approved change scope: only the
user-confirmed `affected_paths` may authorize changes. Read legacy
`bouncer.graph` and evidence without `quality`/`candidates` only for
compatibility; do not author the legacy form in new plans.

**Generated evidence fields.** `bouncer.scope_evidence`, verification, review,
context-review, comprehension metadata, `bouncer.commit_sha` (tasks, 8-char
hex written by commit), and `bouncer.task_commits` (explain, copied at finalize)
record their respective workflow evidence. Treat all of them as data produced by
their designated step. Do not manufacture values to satisfy a gate; correct the
plan, rerun the designated step, or return to planning.

## Derived context-digest anchors

Wave 2 context-digest generates these derived headings from the approved
epic → blueprint → task tree. They are search metadata, not an authoring
obligation: people do not manually write anchors in context documents.

Each anchor is a single token using only the tokenizer-safe
`[A-Za-z0-9_./-]` character basis and zero-padded three-digit ids:

- `epic-<ddd>` — for example, `epic-054`
- `bp-<ddd>-<ddd>` — for example, `bp-054-001`
- `task-<ddd>-<ddd>-<ddd>` — for example, `task-054-001-002`

Colons, spaces, and Korean text are forbidden in an anchor. In particular,
`epic:054` is two search tokens rather than one anchor. Child headings repeat
their parent anchors, so a graph query can invoke an epic, blueprint, or task
level of the hierarchy while retaining its ancestry.

A task unit is the three-document bundle
`tasks/<NNN>/{tasks,verification,review}.md`; each file has its own OKF
frontmatter and `resource` path. Root task layouts are input only to
`bouncer migrate task-layout`. Blueprint-root documents sit beside that
bundle: `explain.md` (written at finalize) and `context-review.md` (plan
document consistency). After finalize deletes task leaves, `explain.md`
`bouncer.task_commits` keeps `{ id, sha }` rows (8-char hex). context-digest
re-emits `task-<ddd>-<ddd>-<ddd>` and the short sha as derived headings so
graph search still resolves task commits.

Task commit staging excludes the task bundle, context documents, and Distill
even when shared scope authorization allows those workflow paths. Finalize
owns their lifecycle: it preserves `explain.md`, Blueprint `index.md`, and
Distill while deleting one-off task evidence and optional context review.

Harness-written timestamps use **KST** (`Asia/Seoul`, offset `+09:00`), e.g.
`2026-08-03T18:00:00.000+09:00`. Pass `--timestamp` to override when scaffolding.

Known divergence from OKF v0.1: epic and blueprint concept documents are named
`index.md`, which §3.1 reserves for directory listings, so the bundle is not
yet §9-conformant. Tracked separately from template authoring.
