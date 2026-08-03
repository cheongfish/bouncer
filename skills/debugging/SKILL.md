---
name: debugging
description: "Use when a change fails verification or behaves unexpectedly. Reproduce, isolate the cause, add a failing regression test, apply a minimum fix, then re-verify. Use only while working inside an active Bouncer blueprint, unless the user explicitly asks for this skill by name."
---

# Debugging

Investigate failures with a short, evidence-first loop.

## Flow

1. **Reproduce** — Capture the failing command, input, and observed result.
2. **Isolate cause** — Narrow to the smallest failing unit; distinguish
   symptom from root cause.
3. **Failing regression test** — Add or tighten a test that fails for the bug
   before the fix exists.
4. **Minimum fix** — Change only what the cause requires; avoid unrelated
   cleanup.
5. **Verification** — Re-run the verify command and confirm the regression
   test passes with the fix.

## Guardrails

- Do not weaken or delete failing tests to force green.
- Prefer one root-cause fix over stacked speculative patches.
- If the fix would expand approved scope, stop and escalate rather than
  shipping a silent scope change.
