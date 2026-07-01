---
description: Execute the active SDD blueprint in an isolated worktree — implement, verify, review, and pass the execute gate.
---

# /sdd-execute

Implement the active blueprint. Follow this sequence.

1. **Read the pointer.** Load the active blueprint dir and base branch from
   `.sdd/current`:
   ```bash
   node -e "console.log(JSON.stringify(require('${CLAUDE_PLUGIN_ROOT}/scripts/lib/current').readCurrent({repoRoot:process.cwd()})))"
   ```
   If it is `null`, stop and tell the user to run `/sdd-plan` first.

2. **Worktree.** Create a blueprint-level worktree + branch:
   - base = the branch checked out now (record it as `base` in `.sdd/current`),
   - branch `sdd/<BP-id>-<slug>`,
   - location `.sdd/worktrees/<BP-id>` (already gitignored):
   ```bash
   git worktree add -b sdd/<BP-id>-<slug> .sdd/worktrees/<BP-id> <base>
   ```
   Re-write `.sdd/current` inside the worktree so the `commit-safety` hook can
   resolve the active blueprint there (`{ "blueprint": "<dir>", "base": "<base>" }`).

3. **Implement.** Work the `tasks.md` checklist as the source of truth. You may
   make **one or more commits**. Every `git commit` is guarded by the
   `commit-safety` hook, which rejects any commit touching a file outside the
   blueprint's `affected_paths` (plus this blueprint's own `context/**` docs).
   Per-task path attribution is not required — all commits share the one
   blueprint-level `affected_paths` set. If a commit is blocked, either edit
   `affected_paths` via `/sdd-plan` intent or drop the stray file.

4. **Verify.** Use the `verification-loop` skill: run `config.verify` until it
   passes, fill `verification.md`, and set `verification → passed`,
   `tasks → verified`.

5. **Review.** Use the `review-loop` skill: AI-review the worktree diff until
   clean, update `review.md`, set `review → accepted`. If
   `sdd.review.required === false`, the loop skips (G8 already satisfied).

6. **Gate.** Run `validate --gate execute` (with the blueprint dir bound in):
   ```bash
   node "${CLAUDE_PLUGIN_ROOT}/scripts/sdd-harness" validate --blueprint <blueprint dir> --gate execute
   ```
   Gate `execute` checks G6 tasks verified, G7 verification passed, G8 review
   accepted (or `required: false`). Fix and re-run until it passes, then point
   the user at `/sdd-finalize`.
