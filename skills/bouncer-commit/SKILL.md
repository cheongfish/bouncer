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
Output contract: `rules/output.md`. Render the commit outcome, subject, worker
SHA, pointer target, and next task or finalize action through that shared
contract; never hide a gate failure or scope violation.

Close one task on the active blueprint. Follow this sequence. Do **not** open a
draft PR, remove a worktree, or run `explain-diff` here — those are
`/bouncer-finalize`.

**Controller and boundary.** A task commit belongs to the worktree that task
was worked in: outside a drive the shared execute worktree, under a
`bouncer-coordinator` drive the worker worktree `coordinate prepare` assigned.
Run every command below with that path as the actual `cwd` — never
`git -C`, never the main checkout, which stays read-only provenance. This skill
commits one task on one worker branch and stops there. Reflecting that commit
into the integration branch is the coordinator's fan-in (`bouncer coordinate
record` then `integrate`), never this skill's, and never a worker's.

**Preflight.** Load the active blueprint:
```bash
bouncer current
```
If `current` is `null`, stop and tell the user to run `/bouncer-plan` first.

Apply the shared returned-value and task-brief selection contract. This
workflow only supplies the current task's scope and its post-commit handoff.

1. **Current.** State the selected `{ blueprint, task, base }` from `bouncer
   current`. Later steps keep that `tasks/<NNN>/tasks.md` brief.

2. **Dry-run.**
   ```bash
   bouncer commit --blueprint <pointer.blueprint>
   ```
   Compact output follows that result; emit raw JSON only on `debug`. On
   `ok: false`, follow `recovery.action` and stop — nothing is staged. On
   `ok: true`, `nextAction` is `confirm-commit` and `stampPath` is `null`.
   The CLI does **not** move the pointer — `nextTask` in the JSON is a
   candidate only.

3. **Confirm the result.** Show `staged` and `commitMessage`. If either is
   wrong, fix the worktree and return to step 2 rather than committing
   something the dry-run did not show. Invoking this skill is the consent for
   this one task commit: this step asks no AskUserQuestion, and a drive's
   start ACQ already covers every task it
   drives.

4. **Commit.**
   ```bash
   bouncer commit --blueprint <pointer.blueprint> --yes
   ```
   Compact output follows that result; emit raw JSON only on `debug`. On
   `ok: false`, follow `recovery.action` and stop. On `ok: true`, read
   `controller`, `nextAction`, and `stampPath`. When `stampPath` is set, the
   CLI wrote `bouncer.commit_sha` into that `tasks.md` so `/bouncer-finalize`
   can copy it into `explain.md` `bouncer.task_commits` — **do not** `git
   checkout` / `git restore` / discard that dirty `tasks.md`. Leave it for
   the next task commit or finalize remainder.

5. **Handoff.** Route on `nextAction`. The commit payload carries the
   provenance the controller routes on: the task SHA on the worker branch,
   the paths the commit actually carried, the ledger record result, and
   `nextTask`.

   When `nextAction` is `return-to-coordinator`, return those to the coordinator and stop. It records the worker SHA with `bouncer coordinate
   record`, reflects it with `bouncer coordinate integrate` in dependency
   order, verifies the integration
   head, and moves the pointer with `bouncer current --set` — one pointer
   serves the whole repository, so no worker moves it and no worker touches the
   integration branch. An unverified fan-in is not a completed task.

   When `nextAction` is `ask-next-task` or `finalize`, report the commit and
   keep the confirm-then-set rule of `rules/current-pointer.md`. With a
   non-null `nextTask`, show its id and path (`tasks/<NNN>/tasks.md`), then
   run this **ACQ**:

   **AskUserQuestion — Next task**
   1. **Re-ground**: Whether to move the pointer to the next open task on this blueprint.
   2. **Recommend-why**: Another commit unit remains in the same PR, so continuing keeps the flow short.
   3. **Options**:
      - A) `bouncer current --set <blueprint> --task <NNN>` (Recommended)
      - B) Report the pointer only — do not `--set`
      - C) Proceed to `/bouncer-finalize` (recommended when `nextTask` is `null`)

   On **A**, run that `--set` and point at `/bouncer-execute`. On **B** or
   **C**, leave the pointer as it is and say so.

## ACQ (AskUserQuestion) gates

Use `rules/acq.md` for the shared ACQ display and chat fallback. A bare
`/bouncer-commit` is not consent for a pointer advance.

**Index:**
- Step 5 — Next task (outside a drive only)

Invoking this skill is the consent for the one task commit it makes, so step 4
asks nothing. Under a drive the coordinator owns the pointer and step 5 asks
nothing either.
