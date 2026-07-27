---
name: verification
description: Use when investigating verification results. Never hand-write success evidence; the execute gate runs the configured command and records it.
---

# Verification

Prepare the verification **deliverable context**. The execute gate is the
evidence authority: it runs the configured command and records the result.

## Steps

1. **Load** — Read the existing verification document (do not create a new
   file), the configured verify command, the worktree cwd, and the tasks brief.
2. **Investigate** — You may run the command to diagnose a failure. Fix one
   logical failure at a time; never weaken tests or the command to force a pass.
3. **Preserve ownership** — Do not manually write `## Command`, `## Evidence`,
   `bouncer.status`, or `bouncer.verification` metadata. The harness records
   those fields when `validate --gate execute` runs the configured command.
4. **Gate** — Run `validate --gate execute` from the worktree. It is the final
   verification run and records the command, output tail, exit code, and run
   time. On any unresolved failure, do **not** claim success; report and stop.

## Guardrails

- Success requires a real pass. The harness, not an agent-authored document,
  records a pass.
- One logical fix at a time; do not weaken tests or the verify command.
- Prefer debugging for repeated failures rather than masking them in evidence.
- The configured command runs on every execute-gate attempt. Expensive or
  external verification needs a future explicit skip policy; it must not be
  silently skipped.
