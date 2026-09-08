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

1. **Scope dry-run.** When present, target task frontmatter fields
   `bouncer.commit_intent` and `bouncer.commit_summary` must each contain 1–2
   Korean terminal sentences (task document only — no blueprint fallback).
   Missing fields remain compatible with older tasks and contribute no bullets;
   malformed fields fail message generation rather than being partly omitted.
   Author valid values at plan time from Goal & intent (no Epic/Blueprint ids,
   file, module, or package names), then proceed.
   Dry-run first:
   ```bash
   bouncer commit --blueprint <pointer.blueprint>
   ```
   This checks every uncommitted change (tracked or untracked) against the
   task's current allowed-set — under a drive that is the coordinator ledger's
   scope for this revision, not the approval snapshot. Anything out of scope is
   a **hard abort — nothing staged**. Show the violations and stop: the fix is
   the controller's, and during a drive it is one `bouncer coordinate revise`
   decision, not an edit to `affected_paths` made here. On a clean dry-run (or
   empty staged set), keep the staged file list + generated commit message.
   This dry-run runs the commit gate once (G6/G7/G8 and G17); on a gate
   failure, stop without `--yes`. (Empty staged set is fine — still continue;
   `--yes` will not create an empty commit.)

   Allowed task-bundle, context, and Distill workflow documents are scope
   candidates but are not task-commit staging candidates. Only task outputs
   are staged; an untracked path must exist before it can be staged.

2. **Commit (deterministic core).** Show the dry-run staged list + generated
   commit message, then commit:
   ```bash
   bouncer commit --blueprint <pointer.blueprint> --yes
   ```
   Invoking this skill is the consent for this one task commit: this step asks
   no AskUserQuestion, and a drive's start ACQ already covers every task it
   drives. If the message or staging is wrong, fix it and re-run step 1 rather
   than committing something the dry-run did not show.
   The CLI does **not** move the pointer — `nextTask` in the JSON is a
   candidate only.

   **Post-commit `tasks.md` stamp.** After a successful `--yes` that created a
   commit, the CLI writes `bouncer.commit_sha` into the pointer task's
   `tasks.md` (working tree only) so `/bouncer-finalize` can copy it into
   `explain.md` `bouncer.task_commits`. That write may re-render YAML and look
   like formatting noise — **do not** `git checkout` / `git restore` / discard
   that dirty `tasks.md`. Leave it for the next task commit or finalize
   remainder.

3. **Hand the result back.** The commit payload carries the provenance the
   controller routes on: the task SHA on the worker branch, the paths the
   commit actually carried, the ledger record result, and `nextTask`.

   Under a coordinator drive, return those to the coordinator and stop. It
   records the worker SHA with `bouncer coordinate record`, reflects it with
   `bouncer coordinate integrate` in dependency order, verifies the integration
   head, and moves the pointer with `bouncer current --set` — one pointer
   serves the whole repository, so no worker moves it and no worker touches the
   integration branch. An unverified fan-in is not a completed task.

   Outside a drive, report the commit and keep the confirm-then-set rule of
   `rules/current-pointer.md`. With a non-null `nextTask`, show its id and path
   (`tasks/<NNN>/tasks.md`), then run this **ACQ**:

   **AskUserQuestion — Next task**
   1. **Re-ground**: Whether to move the pointer to the next open task on this blueprint.
   2. **Recommend-why**: Another commit unit remains in the same PR, so continuing keeps the flow short.
   3. **Options**:
      - A) `bouncer current --set <blueprint> --task <NNN>` (Recommended)
      - B) Report the pointer only — do not `--set`
      - C) Proceed to `/bouncer-finalize` (recommended when `nextTask` is `null`)

   On **A**, run that `--set` and point at `/bouncer-execute`. On **B** or
   **C**, leave the pointer as it is and say so.

4. **Report.** Render through `rules/output.md`: commit outcome (including an
   empty staged set), commit subject, worker branch SHA, pointer target, and
   next task or `/bouncer-finalize` action.

## ACQ (AskUserQuestion) gates

Use `rules/acq.md` for the shared ACQ display and chat fallback. A bare
`/bouncer-commit` is not consent for a pointer advance.

**Index:**
- Step 3 — Next task (outside a drive only)

Invoking this skill is the consent for the one task commit it makes, so step 2
asks nothing. Under a drive the coordinator owns the pointer and step 3 asks
nothing either.
