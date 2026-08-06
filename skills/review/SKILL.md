---
name: review
description: "Use when reviewing a change against the tasks brief. Record ## Findings with severity and disposition; never accept while an actionable finding remains unresolved. Use only while working inside an active Bouncer blueprint, unless the user explicitly asks for this skill by name."
---

# Review

Produce the review **deliverable contract**. Gates judge the result; this skill
only produces findings and dispositions.

Dispatch template: sibling [`reviewer-prompt.md`](reviewer-prompt.md) (call
brief slot). Named agent: plugin `agents/bouncer-reviewer.md`.

## Steps

1. **Load** — Read the existing review document (do not create a new file), the
   worktree diff basis (`git diff <base>...HEAD` plus untracked), and `tasks-001.md`
   (Goal & intent, Interface, Touch, Do not touch, Constraints, Checklist).
2. **Contract** — The review body must end with a `## Findings` section. Record
   each finding with:
   - `severity`: one of `blocker | major | minor | nit`;
   - `status`: `resolved` or `accepted`;
   - `accepted` findings **require** a note (the accepted-risk rationale).
   Mark the review accepted only when no actionable finding remains unresolved
   (every finding `resolved`, or `accepted` with a note).
3. **Review** — Fill [`reviewer-prompt.md`](reviewer-prompt.md) and dispatch
   **`bouncer-reviewer`** with this order:

   1. Resolve the model (never throws; `null` means parent-session inherit):
      ```bash
      BOUNCER_ROOT="${BOUNCER_HOME:-${CLAUDE_PLUGIN_ROOT:-${PLUGIN_ROOT:-}}}"
      node -e "console.log(JSON.stringify(require('${BOUNCER_ROOT}/scripts/lib/subagents').resolveSubagentModel({repoRoot:process.cwd(),agentName:'bouncer-reviewer'})))"
      ```
   2. Call named agent `bouncer-reviewer` with that `model` (attach the filled
      brief slot as the call prompt).
   3. If the host rejects the model slug, retry with `inherit` and tell the
      user the slug was refused.
   4. If the host has no named-agent support (e.g. Codex), fall back to a
      **fresh generic** subagent with the same prompt, or an inline read-only
      pass when no subagent tool exists.

   Judge the diff with:

   ### Spec compliance
   - **Missing** — Checklist / Interface requirement absent from the diff.
     Interface states what the change rejects as well as what it provides;
     an unimplemented rejection path is Missing, not a nit.
   - **Extra** — outside Touch / Interface (scope creep), or a Do not touch breach
   - **Misunderstood** — intent present but implemented incorrectly
   - **Constraint breach** — a Constraints rule broken inside an allowed path.
     Do not touch covers paths; Constraints covers everything else, so a diff
     can stay entirely within `affected_paths` and still violate the brief.

   ### Code quality
   Defects introduced by this change: incorrect logic, broken contracts/tests,
   unsafe error handling, brittle structure, unclear new interfaces.
   Also flag missing explanatory comments on non-trivial new logic (why,
   invariants, trade-offs, known ceilings) — not narrating what the next line
   already says.
   Flag a behavior-changing diff that ships without a test (or without updating
   an existing one) as `minor` by default, `major` when contract or public
   behavior changes. Do **not** apply this to docs-only or configuration-only
   diffs.

   ### Over-engineering (advisory → finding when actionable)
   Prefer deletion / simplification findings when the diff invents surface the
   brief did not need:
   - reinvented stdlib or native platform capability
   - new dependency that installed code or a few lines already cover
   - unrequested abstraction (single-implementation interface, one-product
     factory, config for a never-changing value, scaffolding “for later”)
   - symptom patch where a shared root-cause fix would be a smaller correct
     diff
   Do **not** treat thorough why-comments as bloat. Do **not** demand dropping
   an approved Checklist item — that is a planning escalate, not a “fix in
   place” acceptance.

   ### Calibration
   Severity is a **label, not a filter**. Report every real issue the pass
   finds, `nit` included, and let the controller's disposition step decide what
   blocks acceptance. Never withhold a finding to keep the list short or to look
   conservative — filtering happens after reporting, not during it.

   Map findings to severity without inflation:
   - `blocker` — must fix before accept (broken verify, Do not touch breach,
     false acceptance risk)
   - `major` — Spec Missing / Misunderstood / Constraint breach, Extra scope
     creep (not Do not touch), or serious quality defect
   - `minor` — real issue, limited blast radius
   - `nit` — style/clarity only

   Over-engineering findings are `minor` by default, `nit` when purely
   stylistic, and only `major` when they are already Extra scope creep or a
   real quality defect. Simpler-is-possible is not a blocker.

   Order: **dispatch → controller records Findings → disposition → accepted**.
   The controller (not the subagent) updates existing `review.md` body
   `## Findings` and `bouncer.review.findings[]`, then disposes each finding.
4. **Assert** — Confirm `## Findings` is present and every finding has an
   actionable disposition. Never leave a false acceptance while an actionable
   finding is unresolved.

## Guardrails

- Never set accepted while an actionable unresolved finding remains.
- Verify each finding before acting; keep commits within allowed paths.
- If review is marked not required by policy (`bouncer.review.required === false`),
  skip and leave status unchanged.
