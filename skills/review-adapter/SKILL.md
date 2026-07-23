---
name: review-adapter
description: Use during /sdd-execute to fill the existing review.md with findings against tasks.md, then assert review→accepted (or skip when review.required is false). Profile-aware — native reviews the diff directly; superpowers delegates. Records the SDD review-findings schema the harness gates.
---

# Review Adapter

SDD adapter binding the review **deliverable contract**. The harness
(gate `execute`, G8 + G14) judges the result; this skill only produces it.

## Step 0 — Resolve profile

Run `sdd-harness profile` (or read `.sdd/config.json` `methodology.profile`).
- `native` → self-contained review (Steps 1–4a).
- `superpowers` → delegated review (Steps 1–4b).
- If `sdd.review.required === false` in `review.md`: **skip** — leave
  `review.status` at scaffolded `pending`; G8 is satisfied by policy and G14 is
  skipped.

## Steps

1. **Load** — Read the existing `review.md` (do not create a new file), the
   worktree diff basis (`git diff <base>...HEAD` plus untracked), and `tasks.md`
   (Goal & intent, Interface, Touch, Do not touch, Checklist).
2. **Contract** — `review.md` must end with a `## Findings` section, and each
   finding must be recorded under `sdd.review.findings[]` as
   `{ id, severity, status, note? }`:
   - `severity`: one of `blocker | major | minor | nit`;
   - `status`: `resolved` or `accepted`;
   - `accepted` findings **require** a `note` (the accepted-risk rationale).
   Set `sdd.status → accepted` only when no actionable finding remains
   unresolved (every finding `resolved`, or `accepted` with a note).
3a. **native — Review directly.** Judge the diff against the tasks Checklist,
    Interface, and Do not touch. Record every finding in the body `## Findings`
    and the `sdd.review.findings[]` schema. Resolve or explicitly accept each.
3b. **superpowers — Delegate.** Run `superpowers:requesting-code-review`, then
    resolve with `superpowers:receiving-code-review` discipline; require it to
    write into this existing `review.md` and populate the same findings schema.
    If those skills are not resolvable, **fail closed**: stop and tell the user
    to install superpowers or switch `methodology.profile` to `native`.
4a/4b. **Assert** — Confirm `review.md` has `## Findings` and a valid
    `sdd.review.findings[]`, then set `sdd.status → accepted`. Never leave a
    false `accepted` while an actionable finding is unresolved. On success (or
    skip): caller runs `sdd-harness validate --gate execute`.

## Guardrails

- Never set `accepted` while an actionable unresolved finding remains.
- Fail-closed applies **only** to the `superpowers` profile when its skills are
  missing; `native` never blocks on external plugins.
- Verify each finding before acting; commits remain commit-safety guarded.
