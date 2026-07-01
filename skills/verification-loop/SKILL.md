---
name: verification-loop
description: Use during /sdd-execute to run the project verify command until it passes, record the outcome in verification.md, and transition verification→passed and tasks→verified. Fully self-contained.
---

# Verification Loop

Drive the blueprint's implementation to a passing verification. This skill is
**self-contained** — it does not depend on any other plugin.

## Steps

1. Read `verify` from `.sdd/config.json` (default `npm test` if unset).
2. Run the verify command in the worktree.
3. **On failure**: read the output, make the smallest fix that addresses the
   actual failure, and re-run. Repeat until it passes. Do not weaken tests or
   the verify command to force a pass; fix the code.
4. **On pass**: fill the existing `verification.md` body with:
   - the exact command run,
   - a one-line pass result and any relevant summary counts.
   Do **not** create a new file — update the scaffolded `verification.md`.
5. Transition statuses (frontmatter `sdd.status`):
   - `verification.md`: `pending → passed`.
   - `tasks.md`: `→ verified`.
6. The caller then runs `sdd-harness validate --gate execute` (checks G6:
   `tasks.status == verified`, G7: `verification.status == passed`).

## Guardrails

- One logical fix at a time; re-run after each so cause and effect stay clear.
- If verification cannot be made to pass, stop and report the blocking failure
  rather than transitioning any status.
