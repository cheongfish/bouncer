---
description: Execute the active Bouncer blueprint in an isolated worktree — implement from tasks.md, verify and review via standalone skills, and pass the execute gate.
---

# /bouncer-execute

Implement the active blueprint. Follow this sequence.

Skill flow (recommended): `implementation` → `verification` → `review` → `minimality`.
On failure investigation, use the `debugging` skill (reproduce → isolate → failing
regression → minimum fix → re-verify).

1. **Read the pointer.** Load the active blueprint dir and base branch from
   `.bouncer/current`:
   ```bash
   node -e "console.log(JSON.stringify(require('${CLAUDE_PLUGIN_ROOT}/scripts/lib/current').readCurrent({repoRoot:process.cwd()})))"
   ```
   If it is `null`, stop and tell the user to run `/bouncer-plan` first.

2. **Worktree.** Create a blueprint-level worktree + branch:
   - base = the branch checked out now (record it as `base` in `.bouncer/current`),
   - branch `bouncer/<BP-id>-<slug>`,
   - location `.bouncer/worktrees/<BP-id>` (already gitignored):
   ```bash
   git worktree add -b bouncer/<BP-id>-<slug> .bouncer/worktrees/<BP-id> <base>
   ```
   Re-write `.bouncer/current` inside the worktree so the `commit-safety` hook can
   resolve the active blueprint there (`{ "blueprint": "<dir>", "base": "<base>" }`).
   **`cd` into `.bouncer/worktrees/<BP-id>` and stay there for every subsequent git
   operation in this session** (`git add`, `git commit`, etc.). Do **not** run
   `git -C .bouncer/worktrees/<BP-id> ...` from the project root — the
   `commit-safety` PreToolUse hook resolves the active blueprint from the
   command's actual working directory (`cwd`), and a `-C`-qualified command
   run from the root reports the root as `cwd`, so the hook would inspect the
   wrong (likely empty) index and fail to guard the commit.

3. **Implement (tasks.md is the sole brief).** Use the `implementation` skill
   and only these `tasks.md` sections as decision authority:
   - Goal & intent
   - Interface
   - Touch
   - Do not touch
   - Checklist
   You may read code/tests/repo context needed to implement. Do **not**
   re-interpret epic/blueprint as a second requirements source. Modify only
   within `affected_paths` (commit-safety enforces). Honor Do not touch. If
   blocked by ambiguity or contradiction, stop and send the user back to
   `/bouncer-plan` — no speculative scope expansion. You may make **one or more
   commits**; every `git commit` is guarded by `commit-safety`.

4. **Verify.** Use the `verification` skill: fill existing `verification.md`
   with `## Command` + `## Evidence`, set `verification → passed`,
   `tasks → verified`. If verification fails, use the `debugging` skill before
   retrying.

5. **Review.** Use the `review` skill: update existing `review.md` with
   `## Findings` and `bouncer.review.findings[]`, set `review → accepted`. If
   `bouncer.review.required === false`, skip (G8 already satisfied).
   While reviewing, you may run the `minimality` skill (advisory) to flag
   unnecessary new dependencies or abstractions in the diff.

6. **Gate.** Run `validate --gate execute`:
   ```bash
   node "${CLAUDE_PLUGIN_ROOT}/scripts/bouncer" validate --blueprint <blueprint dir> --gate execute
   ```
   Gate `execute` checks G6 tasks verified, G7 verification passed, G8 review
   accepted (or `required: false`). Fix and re-run until it passes, then point
   the user at `/bouncer-finalize`.
