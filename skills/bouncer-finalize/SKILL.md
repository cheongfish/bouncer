---
name: bouncer-finalize
description: "Use only when the user explicitly asks /bouncer-finalize; it closes the active blueprint including explain, quiz, and PR handoff."
---
# /bouncer-finalize

**Plugin root.** See `rules/plugin-root.md` for the shared root-selection and rule-loading contract.

**Master rules.** Before the numbered steps, Read `${BOUNCER_ROOT}/CLAUDE.md`
(`AGENTS.md` imports `@CLAUDE.md`). Product detail:
`rules/governance.md`, `rules/okf.md`.
Pointer contract: `rules/current-pointer.md`.
Output contract: `rules/output.md`. Preserve every ACQ display; render the
finalize outcome, changed targets, verification, and next blueprint or
`/bouncer-plan` action through that shared contract.

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
worktree removal runs from the main worktree — do not remove
from inside a checkout you are removing.

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

1. **Explain + quiz.** When authoring or refreshing explain and running the quiz,
read [explain-quiz.md](./references/explain-quiz.md). It directs `explain-diff`
(`${BOUNCER_ROOT}/references/explain-diff/index.md`). If the user does not answer
the quiz, **stop** — do not continue to validate or `finalize --yes`.

2. **Validate + remainder commit (deterministic core) + worktree choice.**
   First confirm the integration is closed: under a drive, every task in the
   coordinator ledger is `integrated` and the integration head verified. A task
   still open, an unverified head, or an unresolved reviewer finding is not a
   finished blueprint — stop and hand it back as a coordinator decision instead
   of recording it as done. An unreadable ledger is the same stop, not a
   non-drive finalize: the payload reports `coordinator.status: 'unreadable'`
   and the CLI refuses with `reason: 'coordinator-ledger'` and the
   `ledgerFile` to repair. Then run the finalize gate:
   ```bash
   bouncer validate --blueprint <pointer.blueprint> --gate finalize
   ```
   The CLI owns the finalize gate, allowed paths, deletions, status transition,
   and commit-message format. On any gate, verify, dry-run, or scope failure,
   preserve documents and worktree; report validator code, cause, path, and
   recovery action, then fix every failure before rerunning. Dry-run:
   ```bash
   bouncer finalize --blueprint <pointer.blueprint>
   ```
   This checks every remaining uncommitted change (tracked or untracked) against
   the allowed-set. Anything out of scope
   is a **hard abort — nothing staged**; show the violations and have the user
   fix paths or remove the stray files. On a clean dry-run (or empty staged
   set), show the staged file list + generated commit message, then run this
   **ACQ** before `--yes`:

   **AskUserQuestion — Remainder commit + worktree**
   1. **Re-ground**: Commit the context-document remainder via
      `finalize --yes` and whether to clean up the execute worktree.
   2. **Recommend-why**: Task commits already finished on `/bouncer-commit`;
      after closing, the execute checkout is usually unnecessary, so removing
      the worktree with the commit gets you back to the main tree faster.
   3. **Options**:
      - A) `finalize --yes` commit + remove execute worktree (Recommended)
      - B) `finalize --yes` commit only — keep worktree
      - C) Fix message/staging and re-check
      - D) Cancel — do not run `--yes`

   On **A** or **B**, commit:
   ```bash
   bouncer finalize --blueprint <pointer.blueprint> --yes
   ```
   `--yes` runs verification commands before staging. Per the shared contract,
   clear the pointer. A `reason: 'verify'` failure has no bypass other than
   fixing the cause and rerunning.
   Remember the worktree choice for step 5 (`remove` on A, `keep` on B).
   On **C**, fix and re-dry-run. On **D**, stop without `--yes`.
   (Empty staged set is fine — still run the ACQ so worktree choice is explicit;
   `--yes` clears the pointer without creating an empty commit.)

3. **Push + draft PR (markdown layer).** When the user chooses to consider a draft PR, read this reference: [draft-pr.md](./references/draft-pr.md). **ACQ — PR:** run that reference's AskUserQuestion before any outward push or draft-PR create. A missing remote or `gh` skips this branch gracefully (no PR ACQ); any accepted PR attempt returns to step 4.

4. **Worktree cleanup (from step 2 choice).** After the remainder choice, when cleaning up the worktree or handing off the next blueprint, read this reference: [cleanup-handoff.md](./references/cleanup-handoff.md). Apply the remembered choice without re-asking. A coordinator drive leaves one integration worktree plus one worker worktree per task; the finalize payload's `worktrees` inventory names them all, and cleanup covers all of them or none.

5. **Next-blueprint handoff.** The same [cleanup-handoff.md](./references/cleanup-handoff.md) reference handles this only after cleanup and only from the finalize payload. **ACQ — Next blueprint:** run that reference's AskUserQuestion before `current --set`; advancement remains confirm-then-`current --set`, never automatic.
   A closed Blueprint is terminal — do not reopen or attach tasks. Follow-up
   work plans a sibling Blueprint in the same Epic or a new Epic via
   `/bouncer-plan`. `--set` eligibility (next-only, excluding draft) is defined
   by the finalize payload and the cleanup-handoff contract above — do not
   arbitrarily `--set` an open sibling.

6. **Report.** Render through `rules/output.md`: explain/quiz outcome, remainder
   commit and resulting `closed` state, PR URL or skip/decline, worktree result,
   pointer result, and the next sibling Blueprint or `/bouncer-plan` action.

## ACQ (AskUserQuestion) gates

Use `rules/acq.md` for the shared ACQ display and chat fallback. A bare
`/bouncer-finalize` is not consent for remainder commit, PR, or pointer
advance.

**Index:**
- Step 2 — Remainder commit + worktree
- Step 3 — PR
- Step 5 — Next blueprint
