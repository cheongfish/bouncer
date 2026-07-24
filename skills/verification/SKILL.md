---
name: verification
description: Use when recording verification results. Run the real verify command, write ## Command and ## Evidence, and never declare success without a real pass.
---

# Verification

Produce the verification **deliverable contract**. Gates judge the result; this
skill only produces honest evidence.

## Steps

1. **Load** — Read the existing verification document (do not create a new
   file), the configured verify command (default `npm test`), the worktree cwd,
   and the tasks brief.
2. **Contract** — The verification body must end with:
   - `## Command` — the exact verify command that was run;
   - `## Evidence` — the pass/fail summary and exit status.
3. **Verify** — Run the verify command in the worktree. Capture the command and
   its output/exit code. Fix one logical failure at a time; never weaken tests
   or the command to force a pass.
4. **Assert** — Confirm `## Command` and `## Evidence` are populated. Only then
   may the calling workflow mark verification passed and tasks verified. On any
   unresolved failure: do **not** claim success; report and stop with no
   half-applied success transitions.

## Guardrails

- Success requires a real pass. Never declare passed without one.
- One logical fix at a time; do not weaken tests or the verify command.
- Prefer debugging for repeated failures rather than masking them in evidence.
