# Reviewer prompt (call brief slot)

This file is **not** the named agent's fixed body. It is the call-prompt slot
the controller fills and attaches when dispatching `bouncer-reviewer` (or the
generic / inline fallback). The agent document (`${BOUNCER_ROOT}/agents/bouncer-reviewer.md`)
owns persona, guards, and the Findings output contract; this slot carries the
per-run mode, target, and brief.

Named `bouncer-reviewer` receives only this filled call slot; its role file
already carries the agent document. A generic or inline fallback receives the
entire body of `${BOUNCER_ROOT}/agents/bouncer-reviewer.md` (Authority through Output contract,
verbatim) plus this filled call slot, as `${BOUNCER_ROOT}/references/review/index.md` step 3
directs. The controller also supplies the actual read-only cwd. This call slot
never grants a reviewer write, status, pointer, or scope authority.

Fill every applicable placeholder, then hand this prompt to the dispatched
reviewer. This is a read-only pass: do not modify files, commit, or change
`review.md` status / frontmatter — Findings only.

## Placeholders

- `{{MODE}}` — `discovery` or `delta`
- `{{PERSPECTIVE}}` — one discovery perspective: `combined`, `spec_scope`,
  `correctness_tests`, `minimality_maintainability`, or `security`; leave empty
  for delta
- `{{STRATEGY}}` — CLI `strategy` from `bouncer review-dispatch execute`
  (`single` | `parallel`); leave empty for delta
- `{{RISK_FLAGS}}` — CLI `risk_flags` array (may be empty); leave empty for
  delta
- `{{TARGET}}` — frozen target: base, head, `snapshot_id` and `snapshot_path`
  from `review-dispatch execute` `target`, brief revision, `task_brief_hash`
  or `task_brief_hashes`, `intent_bundle_id` / `intent_bundles`,
  `intent_bundle_revision`, and latest verify result
- `{{BRIEF}}` — when `review_scope` is `blueprint`, every commit task brief
  (Goal & intent, Current behavior, Target behavior, Interface, Touch, Do not
  touch, Constraints, Checklist) plus the blueprint Contract; when
  `review_scope` is absent, the pointer task brief (`tasks/<NNN>/tasks.md`)
  those same sections only. Omit Current behavior or Target behavior when the
  brief has none; this list is separate from the `intent_sections` projection
- `{{INTENT_SECTIONS}}` — role `intent_sections` projection from
  `bouncer intent sections --task <current.task.path> --role reviewer`;
  do not paste the full Explain body here
- `{{TASK_BRIEF_HASH}}` — frozen `task_brief_hash` (absent-`review_scope` path)
  or the `task_brief_hashes` map
- `{{INTENT_BUNDLE_ID}}` — frozen `intent_bundle_id` or the `intent_bundles` map
- `{{INTENT_BUNDLE_REVISION}}` — frozen `intent_bundle_revision`
- `{{CONSTRAINTS}}` — each supplied brief `## Constraints` list verbatim, plus Do
  not touch paths, `affected_paths`, and repo norms. Paste the rules; do not
  summarize them, or the reviewer cannot tell a breach from a judgement call.
- `{{RED_RUN}}` — one `TASKS-NNN: <Red run value>` line per commit task in
  the review scope (task scope: one line; blueprint scope: every commit task
  in task-number order), copied from that task's latest-attempt report
  (`.bouncer/runtime/reports/<task>-<attempt>.md`) or, on an inline path, from
  the controller's own red run; `TASKS-NNN: 미제공` when no report is found
- `{{PREVIOUS_FINDINGS}}` — delta only: stable IDs and fields from earlier
  rounds
- `{{RESOLUTION}}` — delta only: how each previous finding was resolved
- `{{REVISION_DIFF}}` — delta only: change since the prior round

## Prompt body

### Mode
`{{MODE}}`

### Perspective
`{{PERSPECTIVE}}`

### Strategy
`{{STRATEGY}}`

### Risk flags
`{{RISK_FLAGS}}`

### Target
{{TARGET}}

Read the change from the frozen snapshot artifact at `snapshot_path` (its
content and metadata are the judgement basis); do not re-collect it with
`git diff` or claim the current checkout's content as the snapshot's. When the
artifact cannot be read or its target disagrees with the base/head above,
report a reclassification request instead of judging.

The target records the **Latest verification** result alongside its base, head,
brief revision, `task_brief_hash`, `intent_bundle_id`, and
`intent_bundle_revision`; do not substitute a later verification result or mix
a different bundle revision into this round.

### Bundle identifiers
- `task_brief_hash`: `{{TASK_BRIEF_HASH}}`
- `intent_bundle_id`: `{{INTENT_BUNDLE_ID}}`
- `intent_bundle_revision`: `{{INTENT_BUNDLE_REVISION}}`

### Brief
{{BRIEF}}

### Intent sections
{{INTENT_SECTIONS}}

### Constraints
{{CONSTRAINTS}}

### Red run
{{RED_RUN}}

Judge these lines under `correctness_tests` by the `Test trust` section of
`${BOUNCER_ROOT}/references/coding-standards/index.md`. Do not assert that a
test detects a defect without a run that shows it, and do not re-run tests.

### Discovery rules

When mode is `discovery`, inspect the frozen target only through the assigned
perspective. Do not receive or use other reviewers' findings, and do not report
outside that perspective. Review adversarially: assume the change is wrong until
the snapshot proves otherwise, but report only must-fix findings — ones that
must be fixed, with a concrete failure (input, path, or brief clause and what
breaks) you can name. An empty Findings list is a valid result. Do not report a style-only remark, a comment or
documentation-comment form, or anything the `npm run ci` commands listed in the
role's Gate-checked items already decide.

- `combined`: apply `spec_scope`, `correctness_tests`, and
  `minimality_maintainability` in one pass. Do not mix in the `security` rubric.
  Record each finding's `category` as the actual sub-rubric name
  (`spec_scope` | `correctness_tests` | `minimality_maintainability`), never
  `combined`.
- `spec_scope`: Missing / Extra / Misunderstood / Constraint breach.
- `correctness_tests`: logic defects, contract or test breakage, error
  handling, and missing behavior-change tests.
- `minimality_maintainability`: unnecessary design and structure.
- `security`: public-input validation, authentication or authorization bypass,
  credential or sensitive-data exposure/logging, and shell or path injection.
  Use only when the controller assigned this perspective in the dispatch
  `perspectives` (a marked `review_contract: brief` blueprint assigns it only
  for `authentication`, `authorization`, or `credential` risk).

Under `correctness_tests`, report a new or changed test that violates the
`Tests` or `Test trust` sections of `${BOUNCER_ROOT}/references/coding-standards/index.md`.

### Delta rules

When mode is `delta`, certify previous-finding resolution and regressions in
`{{REVISION_DIFF}}`. Delta judges the whole change in its own new
snapshot (taken after the fix; the target carries that `snapshot_id`), not only
the repair hunks; the previous findings and the previous snapshot are
comparison evidence only; `{{REVISION_DIFF}}` remains origin
evidence for new findings. Do not reopen the target as a new discovery pass and do
not receive a discovery perspective. Do not report a new `minor` in
unchanged code. A new finding must be either:

- `introduced_by_revision`, with the revision-diff location as origin evidence;
  any severity is permitted.
- `missed_critical`, a false-acceptance path with origin evidence; only
  `blocker` or `major` is permitted.

### Previous findings (delta only)
{{PREVIOUS_FINDINGS}}

### Resolution (delta only)
{{RESOLUTION}}

### Revision diff (delta only)
{{REVISION_DIFF}}

### Output

Return **only** a Findings list. For each finding include:

- stable `id` and relation: `new | resolved | regressed | unresolved`
  `unresolved` is a previous finding still present under the same id and not a regression; the controller keeps it `status: open`.
- `severity`: `blocker | major | minor` (never emit `nit`; it remains only as
  a legacy recorded value)
- `category`, `brief_clause`, `file`, `symbol`, and their TASKS-001 fingerprint
  form: `<category>:<brief_clause>:<file>#<symbol>`
- summary and evidence (`file:line` or concrete diff reference)
- `origin`: `discovery`, `introduced_by_revision`, or `missed_critical`; for a
  new delta finding, include its revision-diff location or false-acceptance path
- actionability hint: `must_fix`; do not emit `advisory` findings (the
  controller may still lower one during disposition)

Add one **Scope/task impact** line — `none`, or the paths and tasks the
findings reach beyond the current `affected_paths`. Do **not** set review
status. Do **not** edit `review.md` (pointer task directory or blueprint root).
