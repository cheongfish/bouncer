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
   Use the returned `blueprint` value verbatim for every document read and
   `--blueprint` argument below; do not reconstruct a root `context/` path.

2. **Worktree.** Create a blueprint-level worktree + branch:
   - base = the branch checked out now (record it as `base` in `.bouncer/current`),
   - branch `bouncer/<BP-id>-<slug>`,
   - location `<runtime worktree root>/<BP-id>`, resolved outside the repository by
     `runtime-state.ensureWorktreeRoot()`:
   ```bash
   WORKTREE_ROOT="$(node -e "process.stdout.write(require('${CLAUDE_PLUGIN_ROOT}/scripts/lib/runtime-state').ensureWorktreeRoot({repoRoot:process.cwd()}))")"
   WORKTREE_PATH="${WORKTREE_ROOT}/<BP-id>"
   git worktree add -b bouncer/<BP-id>-<slug> "${WORKTREE_PATH}" <base>
   ```
   The active pointer is stored under the Git common directory, so the worktree
   resolves the same pointer without copying it into the repository. **Set every
   subsequent Git operation's actual `cwd` to `${WORKTREE_PATH}`** (`git add`,
   `git commit`, etc.). Do **not** run `git -C "${WORKTREE_PATH}" ...` from the
   project root — the `commit-safety` PreToolUse hook uses the command's actual
   working directory and would otherwise inspect the wrong index.

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

4. **Verify.** Use the `verification` skill to investigate failures and prepare
   the existing `verification.md`. Do not hand-write success evidence or set
   `verification → passed`: the execute gate runs the configured verify command
   and the harness records `## Command`, `## Evidence`, exit status, and run
   metadata. Set `tasks → verified` only after the implementation work is
   complete. If verification fails, use the `debugging` skill before retrying.

5. **Review.** Use the `review` skill: update existing `review.md` with
   `## Findings` and `bouncer.review.findings[]`, set `review → accepted`. If
   `bouncer.review.required === false`, skip (G8 already satisfied).
   While reviewing, you may run the `minimality` skill (advisory) to flag
   unnecessary new dependencies or abstractions in the diff.

6. **Gate.** Run `validate --gate execute`:
   ```bash
   node "${CLAUDE_PLUGIN_ROOT}/scripts/bouncer" validate --blueprint <pointer.blueprint> --gate execute
   ```
   Before evaluating G6–G14, `validate --gate execute` runs the configured
   verify command in the worktree and records its evidence. Gate `execute`
   then checks G6 tasks verified, G7 verification passed, G8 review accepted
   (or `required: false`). Fix and re-run until it passes, then point the user
   at `/bouncer-finalize`.
