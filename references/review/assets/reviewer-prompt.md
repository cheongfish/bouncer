# Reviewer prompt (call brief slot)

This file is **not** the named agent's fixed body. It is the call-prompt slot
the controller fills and attaches when dispatching `bouncer-reviewer` (or the
generic / inline fallback). The agent document (`agents/bouncer-reviewer.md`)
owns persona, guards, and the Findings output contract; this slot carries the
per-run mode, target, and brief.

Fill every applicable placeholder, then hand this prompt to the dispatched
reviewer. This is a read-only pass: do not modify files, commit, or change the
pointer task directory's `review.md` status / frontmatter — Findings only.

## Placeholders

- `{{MODE}}` — `discovery` or `delta`
- `{{PERSPECTIVE}}` — one discovery perspective: `spec_scope`,
  `correctness_tests`, `minimality_maintainability`, or `security`; leave empty
  for delta
- `{{TARGET}}` — frozen target: base, head, brief revision, and latest verify
  result
- `{{BRIEF}}` — task brief (`tasks/<NNN>/tasks.md`) Goal & intent, Interface,
  Touch, Do not touch, Constraints, Checklist
- `{{CONSTRAINTS}}` — the task brief `## Constraints` list verbatim, plus Do
  not touch paths, `affected_paths`, and repo norms. Paste the rules; do not
  summarize them, or the reviewer cannot tell a breach from a judgement call.
- `{{PREVIOUS_FINDINGS}}` — delta only: stable IDs and fields from earlier
  rounds
- `{{RESOLUTION}}` — delta only: how each previous finding was resolved
- `{{REVISION_DIFF}}` — delta only: change since the prior round

## Prompt body

### Mode
`{{MODE}}`

### Perspective
`{{PERSPECTIVE}}`

### Target
{{TARGET}}

The target records the **Latest verification** result alongside its base, head,
and brief revision; do not substitute a later verification result.

### Brief
{{BRIEF}}

### Constraints
{{CONSTRAINTS}}

### Discovery rules

When mode is `discovery`, inspect the frozen target only through the assigned
perspective. Do not receive or use other reviewers' findings, and do not report
outside that perspective. Severity is a label, not a filter, within the assigned
perspective.

- `spec_scope`: Missing / Extra / Misunderstood / Constraint breach.
- `correctness_tests`: logic defects, contract or test breakage, error
  handling, and missing behavior-change tests.
- `minimality_maintainability`: unnecessary design, explanation for non-obvious
  logic, and structure.
- `security`: public-input validation, authentication or authorization bypass,
  credential or sensitive-data exposure/logging, and shell or path injection.
  Use only when the controller assigned this perspective.

### Delta rules

When mode is `delta`, certify previous-finding resolution and regressions in
`{{REVISION_DIFF}}`; do not reopen the target as a new discovery pass. Do not
report a new `minor` or `nit` in unchanged code. A new finding must be either:

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

- stable `id` and relation: `new | resolved | regressed`
- `severity`: `blocker | major | minor | nit`
- `category`, `brief_clause`, `file`, `symbol`, and their TASKS-001 fingerprint
  form: `<category>:<brief_clause>:<file>#<symbol>`
- summary and evidence (`file:line` or concrete diff reference)
- `origin`: `discovery`, `introduced_by_revision`, or `missed_critical`; for a
  new delta finding, include its revision-diff location or false-acceptance path
- actionability hint: `must_fix | advisory` (`advisory` only)

Add one **Scope/task impact** line — `none`, or the paths and tasks the
findings reach beyond the current `affected_paths`. Do **not** set review
status. Do **not** edit the pointer task directory's `review.md`.
