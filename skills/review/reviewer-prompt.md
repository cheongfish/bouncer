# Reviewer prompt (call brief slot)

This file is **not** the named agent's fixed body. It is the **call prompt
slot** the controller fills and attaches when dispatching `bouncer-reviewer`
(or the generic / inline fallback). The agent document
(`agents/bouncer-reviewer.md`) owns persona, guards, and the Findings output
contract; this slot carries the per-run brief and refs.

Fill every placeholder, then hand this prompt to the dispatched reviewer. This
is a read-only pass: do not modify files, commit, or change `review.md`
status / frontmatter — Findings only.

## Placeholders

- `{{BRIEF}}` — `tasks.md` Goal & intent, Interface, Touch, Do not touch, Constraints, Checklist
- `{{BASE}}` — review base ref (branch or commit)
- `{{HEAD}}` — review HEAD ref (usually the worktree tip)
- `{{CONSTRAINTS}}` — the `tasks.md` `## Constraints` list verbatim, plus Do not
  touch paths, `affected_paths`, and repo norms. Paste the rules; do not
  summarize them, or the reviewer cannot tell a breach from a judgement call.

## Prompt body

### Brief
{{BRIEF}}

### Diff basis
Review `git diff {{BASE}}...{{HEAD}}` plus untracked files relevant to Touch /
`affected_paths`. Cite evidence as `file:line` when possible.

### Constraints
{{CONSTRAINTS}}

### Rubric — Spec compliance
Judge the diff against the brief Checklist, Interface, and Constraints:
- **Missing** — required behavior or checklist item absent. Interface declares
  what the change rejects as well as what it provides; a missing rejection or
  error path counts here.
- **Extra** — work outside Touch / Interface (scope creep), or Do not touch violations
- **Misunderstood** — brief intent present but implemented incorrectly
- **Constraint breach** — a Constraints rule broken within an allowed path.
  Check these even when every changed file is inside `affected_paths`.

### Rubric — Code quality
Flag defects that would ship: incorrect logic, broken contracts/tests, unsafe
error handling, brittle structure, or unclear interfaces introduced by this
diff. Prefer findings tied to this change over pre-existing nits. Also flag
non-trivial new logic that lacks comments explaining **why**, invariants,
trade-offs, or known ceilings (do not demand comments that only restate the
next line).
Flag a behavior-changing diff that ships without a test (or without updating
an existing one) as `minor` by default, `major` when contract or public
behavior changes. Do **not** apply this to docs-only or configuration-only
diffs.

### Rubric — Over-engineering
Flag deletable or simplifiable surface the brief did not need:
- reinvented stdlib / native platform capability
- new dependency covered by installed code or a few lines
- unrequested abstraction (single-implementation interface, one-product
  factory, never-changing config, scaffolding “for later”)
- symptom patch where a shared root-cause fix would be smaller and correct
Do **not** treat thorough why-comments as bloat. Do **not** ask to drop an
approved Checklist item in-place — call that out as a planning conflict.

### Rubric — Calibration (severity)
Map each finding to exactly one severity:
- `blocker` — must fix before accept (broken verify, Do not touch breach, false acceptance risk)
- `major` — Spec Missing / Misunderstood / Constraint breach, Extra scope creep (not Do not touch), or serious quality defect
- `minor` — real issue, limited blast radius
- `nit` — style/clarity only; do not inflate

Over-engineering findings are `minor` by default, `nit` when purely stylistic,
and only `major` when they are already Extra scope creep or a real quality
defect. Simpler-is-possible is never a blocker.

### Output
Return **only** a Findings list. For each finding include:
- `severity`: `blocker | major | minor | nit`
- summary
- evidence (`file:line` or concrete diff reference)
- suggested disposition hint (`resolve` vs accept-with-note) — advisory only

Do **not** set review status to accepted. Do **not** edit `review.md`.
