---
description: Execute the active SDD blueprint in an isolated worktree — implement from tasks.md, verify and review via superpowers adapters, and pass the execute gate.
---

# /sdd-execute

Implement the active blueprint. Follow this sequence.

1. **Read the pointer.** Load the active blueprint dir and base branch from
   `.sdd/current`:
   ```bash
   node -e "console.log(JSON.stringify(require('${CLAUDE_PLUGIN_ROOT}/scripts/lib/current').readCurrent({repoRoot:process.cwd()})))"
   ```
   If it is `null`, stop and tell the user to run `/sdd-plan` first.

2. **Preflight (profile-aware).** Resolve the active methodology profile:
   ```bash
   node "${CLAUDE_PLUGIN_ROOT}/scripts/sdd-harness" profile
   ```
   - `native`: no external plugin is required. Proceed. The
     `verification-adapter` and `review-adapter` run their self-contained
     paths and record the real verify command, evidence, and review findings.
   - `superpowers`: confirm these skills are resolvable in this session —
     `superpowers:verification-before-completion` and
     `superpowers:requesting-code-review`. If either is missing, **fail closed**:
     stop, tell the user to install/enable the superpowers plugin or switch
     `methodology.profile` to `native`, then re-run `/sdd-execute`. Do not
     start the implement/verify/review path or write success statuses.

3. **Worktree.** Create a blueprint-level worktree + branch:
   - base = the branch checked out now (record it as `base` in `.sdd/current`),
   - branch `sdd/<BP-id>-<slug>`,
   - location `.sdd/worktrees/<BP-id>` (already gitignored):
   ```bash
   git worktree add -b sdd/<BP-id>-<slug> .sdd/worktrees/<BP-id> <base>
   ```
   Re-write `.sdd/current` inside the worktree so the `commit-safety` hook can
   resolve the active blueprint there (`{ "blueprint": "<dir>", "base": "<base>" }`).
   **`cd` into `.sdd/worktrees/<BP-id>` and stay there for every subsequent git
   operation in this session** (`git add`, `git commit`, etc.). Do **not** run
   `git -C .sdd/worktrees/<BP-id> ...` from the project root — the
   `commit-safety` PreToolUse hook resolves the active blueprint from the
   command's actual working directory (`cwd`), and a `-C`-qualified command
   run from the root reports the root as `cwd`, so the hook would inspect the
   wrong (likely empty) index and fail to guard the commit.

4. **Implement (tasks.md is the sole brief).** Use only these `tasks.md`
   sections as decision authority:
   - Goal & intent
   - Interface
   - Touch
   - Do not touch
   - Checklist
   You may read code/tests/repo context needed to implement. Do **not**
   re-interpret epic/blueprint as a second requirements source. Modify only
   within `affected_paths` (commit-safety enforces). Honor Do not touch. If
   blocked by ambiguity or contradiction, stop and send the user back to
   `/sdd-plan` — no speculative scope expansion. You may make **one or more
   commits**; every `git commit` is guarded by `commit-safety`.

5. **Verify.** Use the `verification-adapter` skill (native runs `config.verify`
   directly; superpowers delegates to `superpowers:verification-before-completion`):
   fill existing `verification.md` with `## Command` + `## Evidence`, set
   `verification → passed`, `tasks → verified`.

6. **Review.** Use the `review-adapter` skill (native reviews the diff directly;
   superpowers delegates to `superpowers:requesting-code-review` /
   receiving-code-review discipline): update existing `review.md` with
   `## Findings` and `sdd.review.findings[]`, set `review → accepted`. If
   `sdd.review.required === false`, the adapter skips (G8 already satisfied).

7. **Gate.** Run `validate --gate execute`:
   ```bash
   node "${CLAUDE_PLUGIN_ROOT}/scripts/sdd-harness" validate --blueprint <blueprint dir> --gate execute
   ```
   Gate `execute` checks G6 tasks verified, G7 verification passed, G8 review
   accepted (or `required: false`). Fix and re-run until it passes, then point
   the user at `/sdd-finalize`.
