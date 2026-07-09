---
name: review-adapter
description: Use during /sdd-execute to drive superpowers code-review skills so they write the existing review.md, then assert review→accepted (or skip when review.required is false). Fail closed; delegates to superpowers only.
---

# Review Adapter

Thin SDD adapter. Superpowers owns **how** to review; this skill only binds the
SDD document contract.

## Steps (exactly four)

1. **Load** — Read the existing scaffolded `review.md` (do not create a new
   file), `.sdd/templates/review.md` if useful, `sdd.review.required`, the
   worktree diff basis (`git diff <base>...HEAD` plus untracked), and `tasks.md`
   (Goal & intent, Interface, Touch, Do not touch, Checklist).
2. **Inject** — When invoking superpowers, pass as binding input:
   - write **into this existing** `review.md` only;
   - judge the diff against the tasks checklist, Interface, and Do not touch;
   - body records findings and resolutions;
   - `sdd.status → accepted` only when no actionable unresolved findings remain;
   - if `sdd.review.required === false`: **skip** invoke/assert success path;
     leave `review.status` at its scaffolded `pending` value; G8 is satisfied
     by policy.
3. **Invoke** — Unless skipped, run `superpowers:requesting-code-review`, then
   resolve findings with `superpowers:receiving-code-review` discipline until
   clean (or stop with unresolved findings).
4. **Assert** — Unless skipped, confirm `review.md` body has findings/resolutions
   and `sdd.status → accepted`. On failure: do not leave a false `accepted`.
   On success (or skip): caller runs `sdd-harness validate --gate execute`.

## Guardrails

- Fail closed: never set `accepted` while an actionable unresolved finding
  remains, and never invent a bundled local review loop.
- No bundled local review loop and no parallel artifact path.
- Verify each finding before acting; commits remain commit-safety guarded.
