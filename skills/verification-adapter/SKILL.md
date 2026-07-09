---
name: verification-adapter
description: Use during /sdd-execute to drive superpowers:verification-before-completion so it writes the existing verification.md, then assert verification→passed and tasks→verified. Fail closed; delegates to superpowers only.
---

# Verification Adapter

Thin SDD adapter. Superpowers owns **how** to verify; this skill only binds the
SDD document contract.

## Steps (exactly four)

1. **Load** — Read the existing scaffolded `verification.md` (do not create a
   new file), `.sdd/templates/verification.md` if useful as a body skeleton,
   `.sdd/config.json` `verify` (default `npm test`), worktree cwd, and the
   blueprint `tasks.md` path.
2. **Inject** — When invoking the superpowers skill, pass as binding input:
   - write **into this existing** `verification.md` only;
   - keep OKF/`sdd:` frontmatter schema; only `sdd.status` may transition
     `pending → passed` after a real pass;
   - body must record the exact verify command and an evidence/exit summary;
   - on unresolved failure: **do not** write success statuses.
3. **Invoke** — Run `superpowers:verification-before-completion` with the
   project `verify` command as the evidence command. Follow that skill until
   verification truly passes or you must stop.
4. **Assert** — Confirm `verification.md` still matches schema expectations
   (existing file, command + evidence in body) and statuses:
   - `verification.md`: `pending → passed`
   - `tasks.md`: `→ verified`
   On assert failure: report and stop with **no** success transitions left
   half-applied. On success: the caller runs
   `sdd-harness validate --gate execute`.

## Guardrails

- Fail closed: if superpowers is unavailable or verification cannot pass, do
  not set `passed` / `verified`.
- No bundled local verify loop and no parallel artifact path.
- One logical fix at a time when the verify command fails; do not weaken tests
  or the verify command to force a pass.
