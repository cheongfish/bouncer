---
name: implementation
description: "Use when implementing from an approved tasks brief. Make focused changes inside allowed paths, keep tests green, and report any deviations from the plan. Use only while working inside an active Bouncer blueprint, unless the user explicitly asks for this skill by name."
---

# Implementation

Execute approved work from the tasks brief without expanding scope.

## Flow

1. **Approved tasks** — Treat `tasks.md` (Goal & intent, Interface, Touch,
   Do not touch, Constraints, Checklist) as the sole brief. Do not invent
   requirements.
2. **Focused change** — Edit only paths justified by Touch / `affected_paths`.
   Respect Do not touch, and honour Constraints inside the paths you are
   allowed to edit. Prefer the smallest change that satisfies the checklist.
3. **Tests first** — For each behavior change, write the failing test, run it,
   and confirm it fails for the expected reason before writing the
   implementation. A test that passes before the change proves nothing, and
   running it is the only way to find that out. Then implement and re-run.
   Keep the project's verify command runnable; do not weaken assertions to
   force a pass.
4. **Report deviations** — If the brief is wrong, incomplete, or blocked by
   reality, stop and report the deviation instead of silently expanding scope
   or rewriting the plan in code.

## Guardrails

- One logical change set at a time; avoid drive-by refactors.
- Do not flip document statuses; the calling workflow owns transitions.
- If verification fails, hand off to debugging rather than papering over the
  failure.
