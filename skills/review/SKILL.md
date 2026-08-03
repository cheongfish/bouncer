---
name: review
description: "Use when reviewing a change against the tasks brief. Record ## Findings with severity and disposition; never accept while an actionable finding remains unresolved. Use only while working inside an active Bouncer blueprint, unless the user explicitly asks for this skill by name."
---

# Review

Produce the review **deliverable contract**. Gates judge the result; this skill
only produces findings and dispositions.

## Steps

1. **Load** — Read the existing review document (do not create a new file), the
   worktree diff basis (`git diff <base>...HEAD` plus untracked), and `tasks.md`
   (Goal & intent, Interface, Touch, Do not touch, Checklist).
2. **Contract** — The review body must end with a `## Findings` section. Record
   each finding with:
   - `severity`: one of `blocker | major | minor | nit`;
   - `status`: `resolved` or `accepted`;
   - `accepted` findings **require** a note (the accepted-risk rationale).
   Mark the review accepted only when no actionable finding remains unresolved
   (every finding `resolved`, or `accepted` with a note).
3. **Review** — Judge the diff against the tasks Checklist, Interface, and
   Do not touch. Record every finding under `## Findings` and dispose each one.
4. **Assert** — Confirm `## Findings` is present and every finding has an
   actionable disposition. Never leave a false acceptance while an actionable
   finding is unresolved.

## Guardrails

- Never set accepted while an actionable unresolved finding remains.
- Verify each finding before acting; keep commits within allowed paths.
- If review is marked not required by policy, skip and leave status unchanged.
