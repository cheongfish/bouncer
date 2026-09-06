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
Output contract: `rules/output.md`. Preserve commit and pointer ACQs; render
the commit outcome, subject, pointer target, and next task or finalize action
through that shared contract.

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
   task's `affected_paths` allowed-set. Anything out of scope is a **hard abort
   — nothing staged**; show the violations and have the user fix
   `affected_paths` or remove the stray files. On a clean dry-run (or empty
   staged set), keep the staged file list + generated commit message for the
   step-2 ACQ. This dry-run runs the commit gate once (G6/G7/G8 and G17); on a
   gate failure, stop without an ACQ or `--yes`. (Empty staged set is fine —
   still continue; `--yes` will not create an empty commit.)

   Allowed task-bundle, context, and Distill workflow documents are scope
   candidates but are not task-commit staging candidates. Only task outputs
   are staged; an untracked path must exist before it can be staged.

2. **Commit (deterministic core).** Show the dry-run staged list + generated
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

3. **Next-task handoff.** After a successful step 2 (including empty staged set
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

4. **Report.** Render through `rules/output.md`: commit outcome (including an
   empty staged set), commit subject, pointer target, and next task or
   `/bouncer-finalize` action.

## ACQ (AskUserQuestion) gates

Use `rules/acq.md` for the shared ACQ display and chat fallback. A bare
`/bouncer-commit` is not consent for commit or pointer advance.

**Index:**
- Step 2 — Commit
- Step 3 — Next task
