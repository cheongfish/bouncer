---
name: bouncer-finalize
description: "Use only when the user explicitly asks /bouncer-finalize; it closes the active blueprint including Distill, explain, quiz, and PR handoff."
---
# /bouncer-finalize

**Plugin root.** See `rules/plugin-root.md` for the shared root-selection and rule-loading contract.

**Master rules.** Before the numbered steps, Read `${BOUNCER_ROOT}/CLAUDE.md`
(`AGENTS.md` imports `@CLAUDE.md`). Product detail:
`rules/governance.md`, `rules/okf.md`.
Pointer contract: `rules/current-pointer.md`.

Close out the active blueprint after every task has been committed via
`/bouncer-commit`. Follow this sequence. Do **not** run `bouncer commit` here —
task commits already landed on `/bouncer-commit`. Comprehension (explain + quiz)
runs in this skill, after the Distill promotion proposal has been handled.

**cwd contract.** Step 1 Distill audit and promotion writes and step 3
`bouncer finalize` continue in the same checkout. When an execute worktree
exists, run inside it. Run the promotion audit without `--repo`; that cwd is
payload `repoRoot`. Keeping cwd on the main worktree while omitting only
`--repo` makes the base fall back to main. Only step 5 worktree removal runs
from the main worktree — do not remove from inside the execute checkout.

**Preflight.** Load the active blueprint:
```bash
bouncer current
```
If `current` is `null`, stop and tell the user to run `/bouncer-plan` first.

Apply the shared returned-value contract. This workflow owns the finalize
outcome that clears the pointer and the post-cleanup next-blueprint handoff.

1. **Propose and promote Distill (one consent).** When proposing and promoting Distill, read this reference: [distill-promotion.md](./references/distill-promotion.md). It directs the conditional `spec-authoring` handoff (`${BOUNCER_ROOT}/references/spec-authoring/index.md`). **ACQ — Distill promotion:** run that reference's one consent before any Distill write; rejection/skip writes nothing and continues to step 2. A reported id-set mismatch also continues to step 2 without promotion.

2. **Explain + quiz.** When authoring or refreshing explain and running the quiz, read this reference: [explain-quiz.md](./references/explain-quiz.md). It directs `explain-diff` (`${BOUNCER_ROOT}/references/explain-diff/index.md`). If the user does not answer the quiz, **stop** — do not continue to validate or `finalize --yes`.

3. **Validate + remainder commit (deterministic core) + worktree choice.**
   Run the finalize gate first:
   ```bash
   bouncer validate --blueprint <pointer.blueprint> --gate finalize
   ```
   Gate `finalize` checks G16 (every task `verified`, explain published with one
   blueprint comprehension entry whose `diff_sha` matches `range_from..HEAD`).
   Fix and re-run until it passes.

   **Retention vs cleanup boundary (CLI contract pointer).** The actual delete
   conditions and allowed paths are defined by the `finalize --yes` CLI and
   validation contract — the skill does not recompute the list or delete files.
   After G16 passes and `--yes` succeeds through verification, the same
   remainder / closing commit deletes one-off documents only and locks Blueprint
   `index.md` to `closed`. Delete targets are `tasks/<NNN>/tasks.md`,
   `tasks/<NNN>/verification.md`, `tasks/<NNN>/review.md`, and when present only
   `context-review.md`. Preserve Blueprint `explain.md`, `index.md`, and
   Distill. Stage deletions for tracked transient documents; remove untracked
   transient documents without staging an absent path. In the same remainder,
   move each task's `commit_sha` (8 digits)
   into `explain.md` `bouncer.task_commits`. On G16 failure, verify failure,
   dry-run, or out-of-scope, do not delete or transition to `closed`; documents
   stay unchanged. Do not propose archive retention, reopening closed
   Blueprints, or retroactive edits to preserved documents.

   Before dry-run, ensure at least one task document has `bouncer.commit_intent`
   as **exactly two** Korean `~함` / `~임` strings when you want background and
   intent on
   any Distill remainder commit. Finalize scans every task in number order and
   uses the highest-numbered valid intent (no blueprint `commit_intent`). Prefer
   values written at plan time; if none are length 2, author them on the latest
   task from Goal & intent / explain (no Epic/Blueprint ids, no file paths),
   then proceed. Dry-run:
   ```bash
   bouncer finalize --blueprint <pointer.blueprint>
   ```
   This checks every remaining uncommitted change (tracked or untracked) against
   the allowed-set (Distill promotion is always allowed). Anything out of scope
   is a **hard abort — nothing staged**; show the violations and have the user
   fix paths or remove the stray files. On a clean dry-run (or empty staged
   set), show the staged file list + generated commit message, then run this
   **ACQ** before `--yes`:

   **AskUserQuestion — Remainder commit + worktree**
   1. **Re-ground**: Commit remainder including Distill promotion via
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

4. **Push + draft PR (markdown layer).** When the user chooses to consider a draft PR, read this reference: [draft-pr.md](./references/draft-pr.md). **ACQ — PR:** run that reference's AskUserQuestion before any outward push or draft-PR create. A missing remote or `gh` skips this branch gracefully (no PR ACQ); any accepted PR attempt returns to step 5.

5. **Worktree cleanup (from step 3 choice).** After the remainder choice, when cleaning up the worktree or handing off the next blueprint, read this reference: [cleanup-handoff.md](./references/cleanup-handoff.md). Apply the remembered choice without re-asking.

6. **Next-blueprint handoff.** The same [cleanup-handoff.md](./references/cleanup-handoff.md) reference handles this only after cleanup and only from the finalize payload. **ACQ — Next blueprint:** run that reference's AskUserQuestion before `current --set`; advancement remains confirm-then-`current --set`, never automatic.
   A closed Blueprint is terminal — do not reopen or attach tasks. Follow-up
   work plans a sibling Blueprint in the same Epic or a new Epic via
   `/bouncer-plan`. `--set` eligibility (next-only, excluding draft) is defined
   by the finalize payload and the cleanup-handoff contract above — do not
   arbitrarily `--set` an open sibling.

7. **Report.** Lead with the outcome, then the detail: whether explain/quiz
   landed, whether a remainder commit landed (and whether the CLI applied
   one-off document deletion, condensed layout, and `closed`), the PR URL (or
   that push/PR was skipped/declined), whether the worktree was removed or left
   in place, whether the active pointer was advanced to the next blueprint or
   left cleared, and that follow-up stays on sibling Blueprint / `/bouncer-plan`
   (preserved evidence is `explain.md`; no closed reopen, archive, or retroactive
   edits). Keep it to
   those facts — no recap of the steps the user just watched run.

## ACQ (AskUserQuestion) gates

Use `rules/acq.md` for the shared ACQ display and chat fallback. A bare
`/bouncer-finalize` is not consent for remainder commit, PR, or pointer
advance.

**Index:**
- Step 1 — Distill promotion
- Step 3 — Remainder commit + worktree
- Step 4 — PR
- Step 6 — Next blueprint
