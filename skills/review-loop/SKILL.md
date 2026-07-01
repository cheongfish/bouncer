---
name: review-loop
description: Use during /sdd-execute to run an AI code review over the worktree diff until findings are resolved, update review.md, and set review→accepted. Skips when review.required is false. Fully self-contained.
---

# Review Loop

Run an AI code review over the blueprint's worktree diff until it is clean, then
record acceptance. This skill is **self-contained** — no dependency on any other
plugin.

## Steps

1. Read `sdd.review.required` from `review.md`.
   - If `required === false`: **skip the loop**. The recorded policy already
     satisfies gate G8. Leave `review.status` as scaffolded and return.
2. Otherwise, produce the worktree diff (e.g. `git diff <base>...HEAD` plus
   untracked files) and review it for correctness bugs, missed requirements from
   `tasks.md`, and obvious reuse/simplification issues. Dispatch a fresh
   subagent for an independent read when the diff is non-trivial.
3. For each finding: decide fix vs. justified rejection. Apply fixes in the
   worktree (guarded commits still apply). Re-review changed areas.
4. Repeat until no actionable findings remain.
5. Update the existing `review.md` body with the findings and their resolutions
   (do **not** create a new file), then set `review.md` `sdd.status → accepted`.
6. The caller then runs `sdd-harness validate --gate execute` (G8: review
   accepted, or `review.required === false`).

## Guardrails

- Verify each finding before acting; do not perform fixes you cannot justify.
- Never set `accepted` while an actionable, unresolved finding remains.
