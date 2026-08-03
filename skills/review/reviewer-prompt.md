# Reviewer prompt

Read-only review dispatch template. Fill every placeholder, then hand this
prompt to a **fresh generic** subagent (or an inline read-only pass when no
subagent tool exists). The reviewer must **not** edit the working tree, commit,
or change `review.md` status / frontmatter — Findings only.

## Placeholders

- `{{BRIEF}}` — `tasks.md` Goal & intent, Interface, Touch, Do not touch, Constraints, Checklist
- `{{BASE}}` — review base ref (branch or commit)
- `{{HEAD}}` — review HEAD ref (usually the worktree tip)
- `{{CONSTRAINTS}}` — the `tasks.md` `## Constraints` list verbatim, plus Do not
  touch paths, `affected_paths`, and repo norms. Paste the rules; do not
  summarize them, or the reviewer cannot tell a breach from a judgement call.

## Prompt body

You are a read-only code reviewer. Do not modify files, run mutating git
commands, or update review document status.

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
diff. Prefer findings tied to this change over pre-existing nits.

### Rubric — Calibration (severity)
Map each finding to exactly one severity:
- `blocker` — must fix before accept (broken verify, Do not touch breach, false acceptance risk)
- `major` — Spec Missing / Misunderstood / Constraint breach, Extra scope creep (not Do not touch), or serious quality defect
- `minor` — real issue, limited blast radius
- `nit` — style/clarity only; do not inflate

### Output
Return **only** a Findings list. For each finding include:
- `severity`: `blocker | major | minor | nit`
- summary
- evidence (`file:line` or concrete diff reference)
- suggested disposition hint (`resolve` vs accept-with-note) — advisory only

Do **not** set review status to accepted. Do **not** edit `review.md`.
