---
name: bouncer-finalize
description: "Use only when the user explicitly asks /bouncer-finalize; it closes the active blueprint including explain, quiz, and PR handoff."
---
# /bouncer-finalize

**Plugin root.** Run `BOUNCER_ROOT="$(bouncer-root --auto)"` once at session start and open every plugin document cited as `${BOUNCER_ROOT}/…` from that root; `${BOUNCER_ROOT}/rules/plugin-root.md` holds the shared root-selection and rule-loading contract.

**Master rules.** Before the numbered steps, Read `${BOUNCER_ROOT}/AGENTS.md`.

Close out the active blueprint after every task has been committed via
`/bouncer-commit`. Follow this sequence. Do **not** run `bouncer commit` here —
task commits already landed on `/bouncer-commit`. Comprehension (explain + quiz)
runs first in this skill.

**cwd contract.** Step 1 explain writes and step 2
`bouncer finalize` continue in the same checkout. When an execute worktree
exists, run inside it; under a `bouncer-coordinator` drive that checkout is the
integration worktree, and its verified HEAD — every task integrated and the
integration verify passed — is the only thing this workflow closes. Never stage
main-worktree source: the main checkout stays read-only provenance. Only step 4
`finalize release-main` and worktree removal run from the main worktree — do
not remove from inside a checkout you are removing.

**Preflight.** Load the active blueprint:
```bash
bouncer current
```
If `current` is `null`, stop and tell the user to run `/bouncer-plan` first.
If the blueprint is `partial_closed`, do not run finalize, commit,
push, PR, pointer clearing, or worktree cleanup. Preserve the coordinator
ledger, integration/worker worktrees, last CI evidence, and untracked
`NEXT_PLAN.md`; hand the user the follow-up-plan approval message instead.

Apply the shared returned-value contract. This workflow owns the finalize
outcome that clears the pointer and the post-cleanup next-blueprint handoff.

1. **Explain + quiz.** First run the read-only digest once and keep that payload
   through step 3 (PR) — `--yes` deletes task documents, so later stages cannot
   rebuild facts from the tasks tree:
   ```bash
   bouncer finalize prepare --blueprint <pointer.blueprint>
   ```
   If `ok` is `false`, report the `reason` and **stop**. Do not invent Explain,
   Quiz, or PR inputs from the coordinator ledger, task documents, or
   verification logs. On success, that digest is the sole factual input for
   Explain, Quiz, and PR. When authoring or refreshing explain and running the
   quiz, read [explain-quiz.md](./references/explain-quiz.md). It directs
   `explain-diff` (`${BOUNCER_ROOT}/references/explain-diff/index.md`) and the
   single `bouncer.comprehension` blueprint entry. If the user does not answer
   the quiz, **stop** — do not continue to validate or `finalize --yes`.

2. **Remainder.** Dry-run, then read `integration` from that payload. `ledger:
   'absent'` is not a drive — continue. `unreadable` is the existing CLI
   `reason: 'coordinator-ledger'` stop, not a non-drive close; do not invent a
   new reject reason. `complete: false` (see `openTasks`; `headVerified` is
   `false` when a verification task is not integrated) is unfinished — stop and
   hand it to the coordinator instead of recording it as done. Read
   `${BOUNCER_ROOT}/rules/commit-scope.md` for the integration worktree boundary and how
   remainder staging differs from a task commit. When running
   the finalize gate, showing the dry-run, or handling scope or `reason:
   'verify'` failures, read [remainder.md](./references/remainder.md). On a
   clean dry-run (or empty staged set), run this **ACQ** before `--yes`:

   **AskUserQuestion — finalize.remainder**
   1. **Re-ground**: Commit the context-document remainder via
      `finalize --yes`. Cleanup always force-removes the execute worktree.
   2. **Recommend-why**: Task commits already finished on `/bouncer-commit`.
   3. **Options**:
      - A) `finalize --yes` commit + remove execute worktree (Recommended)
      - C) Fix message/staging and re-check
      - D) Cancel — do not run `--yes`

   On **A**, commit:
   ```bash
   bouncer finalize --blueprint <pointer.blueprint> --yes
   ```
   On **C**, fix and re-dry-run. On **D**, stop without `--yes`.
   (Empty staged set is fine — still run the ACQ so the remainder commit is
   explicit; `--yes` clears the pointer without creating an empty commit.)
   If a later call reports `task-documents-missing` after `--yes`, treat the
   blueprint as already closed — do not re-run prepare against a deleted tasks
   tree.

3. **PR.** When the user chooses to consider a draft PR, read this reference: [draft-pr.md](./references/draft-pr.md). Use the prepare digest kept from step 1 for title prefix and body sections; do not recompute them. **ACQ — PR (`finalize.pr`):** run that reference's AskUserQuestion before any outward push or draft-PR create. A missing remote or `gh` skips this branch gracefully (no PR ACQ); any accepted PR attempt returns to step 4.

4. **Cleanup.** After `--yes`, read [cleanup-handoff.md](./references/cleanup-handoff.md): from the main worktree run `finalize release-main`, then `git worktree remove --force`. A coordinator drive leaves one integration worktree plus one worker worktree per task; the finalize payload's `worktrees` inventory names them all, and cleanup covers all of them or none.

5. **Handoff.** The same [cleanup-handoff.md](./references/cleanup-handoff.md) runs `--set` from `release-main` `next` without asking.
   Read `${BOUNCER_ROOT}/rules/current-pointer.md` for that pointer change.
   A closed Blueprint is terminal — do not reopen or attach tasks. Follow-up
   work plans a sibling Blueprint in the same Epic or a new Epic via
   `/bouncer-plan`. `--set` eligibility (next-only, excluding draft) is defined
   by the cleanup-handoff contract — do not arbitrarily `--set` an open sibling.
   Render through `${BOUNCER_ROOT}/rules/output.md`: explain/quiz outcome, remainder commit and
   resulting `closed` state, `integration` (`complete`, `openTasks`,
   `headVerified`), PR URL or skip/decline, worktree result, pointer result, and
   the next sibling Blueprint or `/bouncer-plan` action.

## ACQ (AskUserQuestion) gates

Use `${BOUNCER_ROOT}/rules/acq.md` for the shared ACQ display and chat fallback. A bare
`/bouncer-finalize` is not consent for remainder commit or PR.

**Index:**
- Step 2 — `finalize.remainder` Remainder commit + worktree
- Step 3 — `finalize.pr` PR
