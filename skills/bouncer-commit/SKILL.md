---
name: bouncer-commit
description: "Use only when the user explicitly asks /bouncer-commit; it commits the active Bouncer task after the commit gate."
---
# /bouncer-commit

**Plugin root.** See `rules/plugin-root.md` for the shared root-selection and rule-loading contract.

**Master rules.** Before the numbered steps, Read `${BOUNCER_ROOT}/CLAUDE.md`
(`AGENTS.md` imports `@CLAUDE.md`). Product detail:
`rules/governance.md`, `rules/okf.md`.
Pointer contract: `rules/current-pointer.md`.

Close one task on the active blueprint. Follow this sequence. Do **not** open a
draft PR, remove the execute worktree, or run `explain-diff` here — those are
`/bouncer-finalize`.

**Preflight.** Load the active blueprint:
```bash
bouncer current
```
If `current` is `null`, stop and tell the user to run `/bouncer-plan` first.

Apply the shared returned-value and task-brief selection contract. This
workflow only supplies the current task's scope and its post-commit handoff.

1. **Scope dry-run.** Ensure the target task frontmatter has
   `bouncer.commit_intent` as **exactly two** Korean `~함` / `~임` strings for
   background/intent (task document only — no blueprint fallback). Prefer values
   written at plan time; if missing or not length 2, author them now from
   Goal & intent (no Epic/Blueprint ids, no file paths), then proceed.
   Dry-run first:
   ```bash
   bouncer commit --blueprint <pointer.blueprint>
   ```
   This checks every uncommitted change (tracked or untracked) against the
   task's `affected_paths` allowed-set. Anything out of scope is a **hard abort
   — nothing staged**; show the violations and have the user fix
   `affected_paths` or remove the stray files. On a clean dry-run (or empty
   staged set), keep the staged file list + generated commit message for the
   step-4 ACQ. (Empty staged set is fine — still continue; `--yes` will not
   create an empty commit.)

   Allowed task-bundle, context, and Distill workflow documents are scope
   candidates but are not task-commit staging candidates. Only task outputs
   are staged; an untracked path must exist before it can be staged.

2. **Validate.** Run the commit gate — `validate --gate commit`:
   ```bash
   bouncer validate --blueprint <pointer.blueprint> --gate commit
   ```
   Gate `commit` re-checks G6/G7/G8 for the pointer task and G17 (staged paths
   inside `affected_paths`). Fix and re-run until it passes.

3. **Status before commit.** Set the pointer task documents to the statuses the
   execute gate already required (`tasks → verified`, `verification → passed`,
   `review → accepted` or `required: false`) if any are still open from the
   execute handoff. Do not invent new status names.

4. **Commit (deterministic core).** Show the dry-run staged list + generated
   commit message, then run this **ACQ** before `--yes`:

   **AskUserQuestion — Commit**
   1. **Re-ground**: Whether to commit this task's changes with `bouncer commit --yes`.
   2. **Recommend-why**: Execute already finished verify and review and the commit gate passed, so closing now keeps scope closed and moves to the next task faster.
   3. **Options**:
      - A) Run `commit --yes` (Recommended)
      - B) Revise message/staging and reconfirm
      - C) Cancel — do not run `--yes`

   On **A**, commit:
   ```bash
   bouncer commit --blueprint <pointer.blueprint> --yes
   ```
   On **B**, fix and re-dry-run from step 1. On **C**, stop without `--yes`.
   The CLI does **not** move the pointer — `nextTask` in the JSON is a candidate
   only.

   **Post-commit `tasks.md` stamp.** After a successful `--yes` that created a
   commit, the CLI writes `bouncer.commit_sha` into the pointer task's
   `tasks.md` (working tree only) so `/bouncer-finalize` can copy it into
   `explain.md` `bouncer.task_commits`. That write may re-render YAML and look
   like formatting noise — **do not** `git checkout` / `git restore` / discard
   that dirty `tasks.md`. Leave it for the next task commit or finalize
   remainder.

5. **Next-task handoff.** After a successful step 4 (including empty staged set
   with `committed: false`), offer to advance the active pointer with an **ACQ**
   — use the commit payload's `nextTask` as required by `rules/current-pointer.md`.
   This direct invocation keeps the shared confirm-then-set rule.

   If `nextTask` is non-null, show the candidate task id and path
   (`tasks/<NNN>/tasks.md`).

   **AskUserQuestion — Next task**
   1. **Re-ground**: Whether to move the pointer to the next open task on the same blueprint.
   2. **Recommend-why**: When another commit unit remains in the same PR (blueprint), continuing with `/bouncer-execute` keeps the flow short.
   3. **Options**:
      - A) `bouncer current --set <blueprint> --task <NNN>` (Recommended)
      - B) Report pointer only — do not `--set`
      - C) Proceed to `/bouncer-finalize` with no remaining tasks (when `nextTask` is null, make
        this the recommended proceed)

   - If A, run:
     ```bash
     bouncer current --set <pointer.blueprint> --task <NNN>
     ```
     Then point the user at `/bouncer-execute` for the next task (same worktree).
   - If `nextTask` is `null`, skip A and recommend `/bouncer-finalize` instead.
   - If B/C leave the pointer as-is (or only report), say so plainly.

6. **Report.** Lead with the outcome, then the detail: whether a commit was
   created (or empty staged set), the commit subject, whether the pointer moved
   to the next task or the user should run `/bouncer-finalize`. Keep it to those
   facts — no recap of the steps the user just watched run.

## ACQ (AskUserQuestion) gates

Use `rules/acq.md` for the shared ACQ display and chat fallback. A bare
`/bouncer-commit` is not consent for commit or pointer advance.

**Index:**
- Step 4 — Commit
- Step 5 — Next task
