---
name: minimality
description: "This skill should be used during planning and review to challenge unnecessary code, dependencies, and abstractions within approved scope — reuse first, prefer stdlib/platform/installed deps, prefer the shortest working surface, record the rationale, and escalate scope conflicts back to planning. It is advisory, not a gate. It is used only while working inside an active Bouncer blueprint, unless the user explicitly asks for this skill by name."
---

# Minimality

Challenge unnecessary surface area while respecting approved requirements. This
skill is **advisory** — it is not a gate. It shapes plans and reviews, not
success status. Implementation applies the same ladder while coding; this skill
challenges plans and diffs before they grow.

## When this applies

- **Plan:** recommended before finalizing `affected_paths` and the Checklist.
- **Review:** recommended while judging the diff for new deps/abstractions and
  the over-engineering lens below.

## Decision ladder (in order)

Stop at the first rung that holds:

1. **Does this need to exist in the plan?** Speculative need = leave it out of
   Touch / Checklist (YAGNI). Do not invent follow-on work “for later.”
2. **Already in this codebase?** Reuse the helper, util, type, or pattern —
   look before proposing a rewrite.
3. Prefer a **native platform feature** over anything new.
4. Prefer the **standard library** over anything new.
5. Prefer an **already installed dependency** over adding a new one.
6. Prefer the **shortest working surface** (fewest files, fewest new types)
   that still meets the brief.
7. Only then propose **minimal new code**.

## Intensity (`bouncer.scale`)

How far to climb is the existing blueprint frontmatter field `bouncer.scale`
(`light` | `full`). Do not invent a new config key or mode word. This mapping
is a skill judgment criterion — not a gate and not a CLI path.

- **`light`:** apply rungs 1–4 only. Record the rationale in one line.
- **Absent or `full`:** apply all 7 rungs.

## Do NOT minimize these

This list always applies, regardless of intensity. `light` does not shrink it.

- Approved requirements, tests, verification, security, accessibility, and
  error handling are **out of scope** for minimization.
- **Explanatory comments** that document why, invariants, trade-offs, or known
  ceilings are **out of scope** for minimization — implementation is expected
  to write them thoroughly for non-trivial logic.
- Do **not** silently drop a feature from an already-approved brief during
  implementation.
- If a requirement itself looks unnecessary, do **not** shrink the
  implementation — return to **planning** and revise the spec.

## Before adding a new dependency, abstraction, or file

- Evaluate a smaller alternative first (reuse → native platform → stdlib →
  installed dep → one-liner → minimum).
- Reject unrequested abstractions: single-implementation interfaces, factories
  for one product, config for a never-changing value, scaffolding “for later.”
- **Record the rationale** in the plan (tasks) or the review record. A new
  dependency needs a written reason — this is a recorded rationale, not a
  separate gate.

## Over-engineering review lens

When judging a plan or diff, flag candidates to delete or simplify:

- Reinvented stdlib / platform capability
- New dependency that a few lines or an installed package already covers
- Speculative abstraction or unused extension point
- Directory-wide Touch that opens more files than the checklist needs
- Symptom patch where a shared root-cause fix would be smaller

## Guardrails

- If a minimality suggestion conflicts with an approved task, do not act
  unilaterally. Escalate: send the work back to planning for re-approval.
- Plan contract blast: do not drop fixture/test paths from Touch to keep
  `affected_paths` short when Interface changes a shared shape — that is a
  planning miss, not minimality. Escalate to widen Touch or defer the change.

## Return

Report minimality suggestions and any conflicts that need planning escalation.
Advisory only — do not invent gate or review acceptance.
