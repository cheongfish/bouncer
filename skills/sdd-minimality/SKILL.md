---
name: sdd-minimality
description: Use during /sdd-plan and /sdd-review to challenge unnecessary code, dependencies, and abstractions within SDD boundaries — reuse first, prefer stdlib/platform/installed deps, record the rationale, and escalate scope conflicts back to /sdd-plan. Advisory, not a gate.
---

# SDD Minimality

Absorbs the Ponytail decision ladder, corrected for SDD boundaries. This skill
is **advisory** — it is not a harness gate. It shapes plans and reviews, not
success status.

## Decision ladder (in order)

1. **Reuse** existing code in the repo.
2. Prefer the **standard library**, **platform features**, or an **already
   installed dependency** over anything new.
3. Only then write **minimal new code**.

## SDD corrections (do NOT minimize these)

- Approved requirements, tests, verification, security, accessibility, and
  error handling are **out of scope** for minimization.
- Do **not** silently drop a feature from an already-approved blueprint during
  implementation.
- If a requirement itself looks unnecessary, do **not** shrink the
  implementation — return to `/sdd-plan` and revise the spec.

## Before adding a new dependency, abstraction, or file

- Evaluate a smaller alternative first.
- **Record the rationale** in the plan (`tasks.md`) or the review record
  (`review.md`). A new dependency needs a written reason — this is a recorded
  rationale, not a separate gate.

## Conflict handling

- If a minimality suggestion conflicts with an approved task, do not act
  unilaterally. Escalate: send the work back to `/sdd-plan` for re-approval.

## When to run

- **Plan:** recommended before finalizing `affected_paths` and the Checklist.
- **Review:** recommended while judging the diff for new deps/abstractions.
