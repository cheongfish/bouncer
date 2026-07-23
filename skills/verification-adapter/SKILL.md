---
name: verification-adapter
description: Use during /sdd-execute to fill the existing verification.md with the real verify command and evidence, then assert verification→passed and tasks→verified. Profile-aware — native runs the verify command directly; superpowers delegates. Never declares success without a real pass.
---

# Verification Adapter

SDD adapter binding the verification **deliverable contract**. The harness
(gate `execute`, G7 + G13) judges the result; this skill only produces it.

## Step 0 — Resolve profile

Run `sdd-harness profile` (or read `.sdd/config.json` `methodology.profile`).
- `native` → self-contained path (Steps 1–4a).
- `superpowers` → delegated path (Steps 1–4b).

## Steps

1. **Load** — Read the existing scaffolded `verification.md` (do not create a
   new file), `.sdd/templates/verification.md` as a body skeleton if useful,
   `.sdd/config.json` `verify` (default `npm test`), the worktree cwd, and the
   blueprint `tasks.md` path.
2. **Contract** — Whatever the profile, `verification.md` must end with:
   - `## Command` — the exact verify command that was run;
   - `## Evidence` — the pass/fail summary and exit status.
   Keep OKF/`sdd:` frontmatter; only `sdd.status` may transition
   `pending → passed`, and only after a real pass.
3a. **native — Verify directly.** Run the `verify` command in the worktree.
    Capture the command and its output/exit code. Fix one logical failure at a
    time; never weaken tests or the command to force a pass.
3b. **superpowers — Delegate.** Run
    `superpowers:verification-before-completion` with the `verify` command as
    the evidence command; require it to write into this existing
    `verification.md` and keep the same body contract. If the superpowers skill
    is not resolvable, **fail closed**: stop and tell the user to install it or
    switch `methodology.profile` to `native`.
4a/4b. **Assert** — Confirm `verification.md` has `## Command` + `## Evidence`
    populated, then set statuses:
    - `verification.md`: `pending → passed`
    - `tasks.md`: `→ verified`
    On any unresolved failure: do **not** set `passed`/`verified`; report and
    stop with no half-applied success transitions. On success: caller runs
    `sdd-harness validate --gate execute`.

## Guardrails

- Success requires a real pass in **either** profile. Never set
  `passed`/`verified` otherwise.
- Fail-closed applies **only** to the `superpowers` profile when its skills are
  missing; `native` never blocks on external plugins.
- One logical fix at a time; do not weaken tests or the verify command.
