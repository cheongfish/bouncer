---
name: bouncer-execute
description: "Use only when the user explicitly asks to execute the active Bouncer blueprint (for example /bouncer-execute). Implement from the pointer's task brief (current.task.path, or the resolver's first/single doc when task is null) in an isolated worktree, verify and review via standalone skills, and pass the execute gate."
---
# /bouncer-execute

**Plugin root.** Every shell block below opens with

```bash
BOUNCER_ROOT="${BOUNCER_HOME:-${CLAUDE_PLUGIN_ROOT:-${PLUGIN_ROOT:-}}}"
```

because each block runs in a fresh shell — the assignment does not carry over,
so it is repeated rather than exported once. Resolution order:
`BOUNCER_HOME` (manual override) → `CLAUDE_PLUGIN_ROOT` (Claude Code, and Codex
compatibility) → `PLUGIN_ROOT` (Codex native). If none are set, `node` fails on
a path starting with `/scripts` — set `BOUNCER_HOME` to the directory that
contains `scripts/bouncer`.

**Master rules.** Before the numbered steps, Read `${BOUNCER_ROOT}/CLAUDE.md`
(`AGENTS.md` imports `@CLAUDE.md`). Product detail:
`docs/governance.md`, `docs/workflow.md`, `docs/okf.md`.

Implement the active blueprint's current task. Follow this sequence. Do **not**
run `git commit` or `bouncer commit` here — after the execute gate passes, point
the user at `/bouncer-commit`.

**Project Distill.** Before implementing, Read `.bouncer/Distill.md`.
If missing, stop and tell the user to run `bouncer init` (or seed the file).
Honor matching Invariants / Gotchas / Decisions inside `affected_paths`.

Skill flow (recommended): `implementation` (`skills/implementation/SKILL.md`) → `verification` (`skills/verification/SKILL.md`) → `review` (`skills/review/SKILL.md`) → `minimality` (`skills/minimality/SKILL.md`).
On verify failure, dispatch `bouncer-debugger` (behavioral brief:
`debugging` / `skills/debugging/SKILL.md` — Root cause → Pattern → Hypothesis
→ Implementation). The debugger is read-only; the implementer or controller
applies the fix.

1. **Read the pointer.** Load the active blueprint dir, base branch, and task brief:
   ```bash
   BOUNCER_ROOT="${BOUNCER_HOME:-${CLAUDE_PLUGIN_ROOT:-${PLUGIN_ROOT:-}}}"
   node "${BOUNCER_ROOT}/scripts/bouncer" current
   ```
   If `current` is `null`:
   - When `ready` is non-empty, show those candidates and tell the user to run
     `bouncer current --set <dir>` (or `/bouncer-plan` if they meant a different
     blueprint), then stop.
   - When `ready` is empty, stop and tell the user to run `/bouncer-plan` first.
   Use the returned `blueprint` value verbatim for every document read and
   `--blueprint` argument below; do not reconstruct a root `context/` path.
   CLI `current.task` is `{ path, id }` when set (pointer file stores path only).
   **Task brief** = `current.task.path` (repo-relative) when `current.task` is
   non-null. When `task` is `null`, use the resolver's single or first task
   task bundle document (`tasks/<NNN>/tasks.md`, or a legacy root task document)
   as today. Later steps
   use that same brief path — do not re-pick a different task document mid-run.

2. **Worktree.** All tasks on the same blueprint **share one** execute worktree
   at `<repo>/.worktrees/<BP-id>`. If that path already exists, **reuse it** —
   do not create a second worktree or a new branch. Only when the worktree is
   missing, create it + branch:
   - base = the branch checked out now (already recorded as `base` in the
     active pointer by `/bouncer-plan`),
   - branch `<type>/<BP-id>-<slug>`, where `<type>` is
     `bouncer.commit_type` from the blueprint index (default `feat`). Use a
     Conventional Commit type from `.gitmessage` —
     `feat` | `fix` | `docs` | `style` | `refactor` | `test` | `chore` —
     matching the work's intent (same field `/bouncer-commit` uses for the
     commit subject type),
   - location `<repo>/.worktrees/<BP-id>`, with the `.worktrees` root created by
     `runtime-state.ensureWorktreeRoot()`:
   ```bash
   BOUNCER_ROOT="${BOUNCER_HOME:-${CLAUDE_PLUGIN_ROOT:-${PLUGIN_ROOT:-}}}"
   WORKTREE_ROOT="$(node -e "process.stdout.write(require('${BOUNCER_ROOT}/scripts/lib/runtime-state').ensureWorktreeRoot({repoRoot:process.cwd()}))")"
   WORKTREE_PATH="${WORKTREE_ROOT}/<BP-id>"
   if [ -d "${WORKTREE_PATH}" ]; then
     : # reuse existing blueprint worktree
   else
     git worktree add -b <type>/<BP-id>-<slug> "${WORKTREE_PATH}" <base>
   fi
   ```
   `/bouncer-plan` does not commit, so the documents it authored exist only in
   the base working tree while a fresh worktree starts from the committed HEAD.
   Always run seed next (also on reuse — no-op when nothing remains to move),
   **from the base `cwd`**, so the worktree has the task brief for step 3:
   ```bash
   BOUNCER_ROOT="${BOUNCER_HOME:-${CLAUDE_PLUGIN_ROOT:-${PLUGIN_ROOT:-}}}"
   node "${BOUNCER_ROOT}/scripts/bouncer" seed-worktree \
     --blueprint <pointer.blueprint> --to "${WORKTREE_PATH}"
   ```
   It moves only the plan context documents (blueprint tree, epic index,
   context index) and returns the base to its committed state; unrelated dirty
   files stay in the base. A `conflict` result means the worktree already holds
   a different version — resolve it by hand rather than re-running. When there
   is nothing left to move, seed returns success with an empty `moved` list.

   The active pointer is stored under the Git common directory, so the worktree
   resolves the same pointer without copying it into the repository. **Set every
   subsequent Git operation's actual `cwd` to `${WORKTREE_PATH}`**. Do **not**
   run `git -C "${WORKTREE_PATH}" ...` from the project root — the
   `commit-safety` PreToolUse hook uses the command's actual working directory
   and would otherwise inspect the wrong index.

3. **Implement (task brief is the sole authority).** Dispatch **`bouncer-implementer`**
   (plugin `agents/bouncer-implementer.md`) with this order — the
   `implementation` skill remains the behavioral brief the agent follows:

   1. Resolve the model:
      ```bash
      BOUNCER_ROOT="${BOUNCER_HOME:-${CLAUDE_PLUGIN_ROOT:-${PLUGIN_ROOT:-}}}"
      node -e "console.log(JSON.stringify(require('${BOUNCER_ROOT}/scripts/lib/subagents').resolveSubagentModel({repoRoot:process.cwd(),agentName:'bouncer-implementer'})))"
      ```
   2. Call named agent `bouncer-implementer` with that `model`, passing only
      these task-brief sections (the pointer task brief from step 1) as decision
      authority: Goal & intent, Interface, Touch, Do not touch, Constraints,
      Checklist.
   3. If the host rejects the model slug, retry with `inherit` and tell the user.
   4. If named agents are unavailable (e.g. Codex), fall back to running the
      `implementation` skill inline (or a fresh generic subagent with the same
      brief).

   Modify only within `affected_paths` (commit-safety enforces). Honor Do not
   touch, and honor Constraints inside the paths you are allowed to edit —
   staying in `affected_paths` is not by itself compliance. If blocked by
   ambiguity or contradiction, stop and send the user back to `/bouncer-plan` —
   no speculative scope expansion.

   **One implementer.** `bouncer-implementer` is the only agent this step
   spawns — one instance, not a fleet. Do not split the task brief across parallel
   implementers (they share `affected_paths` and would collide), and do not add
   a second agent to check the first one's work; step 4 and step 5 already cover
   that with the gate and the reviewer.

   **Controller owns document status transitions; `/bouncer-commit` owns the
   commit.** The implementer must not `git commit` or flip `tasks` /
   `verification` / `review` status. After this skill returns, do **not** run
   `git commit` / `bouncer commit` yourself — hand off to `/bouncer-commit`.
   Any accidental `git commit` is still guarded by `commit-safety`.

4. **Verify.** Use the `verification` skill (`skills/verification/SKILL.md`) to
   prepare the existing `<pointer task directory>/verification.md`. Do not hand-write success evidence
   or set `verification → passed`: the execute gate runs the configured verify
   command and the harness records `## Command`, `## Evidence`, exit status,
   and run metadata. Set `tasks → verified` only after the implementation work
   is complete.

   **On verify failure**, dispatch **`bouncer-debugger`** (plugin
   `agents/bouncer-debugger.md`) with this order — the `debugging` skill
   remains the behavioral brief the agent follows:

   1. Resolve the model:
      ```bash
      BOUNCER_ROOT="${BOUNCER_HOME:-${CLAUDE_PLUGIN_ROOT:-${PLUGIN_ROOT:-}}}"
      node -e "console.log(JSON.stringify(require('${BOUNCER_ROOT}/scripts/lib/subagents').resolveSubagentModel({repoRoot:process.cwd(),agentName:'bouncer-debugger'})))"
      ```
   2. Call named agent `bouncer-debugger` with that `model`, passing the
      failing verify evidence plus only these task-brief sections (the pointer
      task brief from step 1) as decision authority: Goal & intent,
      Interface, Touch, Do not touch, Constraints, Checklist.
   3. If the host rejects the model slug, retry with `inherit` and tell the user.
   4. If named agents are unavailable (e.g. Codex), fall back to running the
      `debugging` skill inline (or a fresh generic read-only subagent with the
      same brief).

   The debugger must **not** edit files, commit, or flip document status — it
   returns a root-cause report only. Apply the minimum fix via
   `bouncer-implementer` (or inline within scope) from that report, then
   re-verify. On the same failing verify, redispatch the debugger at most
   **3** times (3 unsuccessful fix cycles); then escalate to architecture /
   `/bouncer-plan` rather than looping.

5. **Review.** If `bouncer.review.required === false`, skip (G8 already satisfied).
   Otherwise use the `review` skill (`skills/review/SKILL.md`) with this order:
   (1) fill `skills/review/reviewer-prompt.md` (brief, base/HEAD, constraints);
   (2) resolve model via `resolveSubagentModel` for `bouncer-reviewer`, then
       dispatch named agent `bouncer-reviewer` with that model (retry `inherit`
       if the slug is rejected; if named agents are unavailable, fall back to a
       **fresh generic** subagent or inline read-only pass with the same prompt);
   (3) as controller, update existing `<pointer task directory>/review.md` body `## Findings` and
   `bouncer.review.findings[]` from the reviewer output — the subagent must not
   flip status;
   (4) if any actionable finding remains unresolved, fix within scope and
   re-review;
   (5) only when every finding is `resolved` or `accepted` with a note, set
   `review → accepted`.
   While reviewing, you may run the `minimality` skill (`skills/minimality/SKILL.md`) (advisory) to flag
   unnecessary new dependencies or abstractions in the diff.

6. **Gate.** Run `validate --gate execute`:
   ```bash
   BOUNCER_ROOT="${BOUNCER_HOME:-${CLAUDE_PLUGIN_ROOT:-${PLUGIN_ROOT:-}}}"
   node "${BOUNCER_ROOT}/scripts/bouncer" validate --blueprint <pointer.blueprint> --gate execute
   ```
   Before evaluating G6–G14, `validate --gate execute` runs the configured
   verify command in the worktree and records its evidence. Gate `execute`
   then checks G6 tasks verified, G7 verification passed, G8 review accepted
   (or `required: false`). Fix and re-run until it passes, then point the user
   at `/bouncer-commit`.
