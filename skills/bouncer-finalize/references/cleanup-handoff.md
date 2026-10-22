After the remainder choice, when cleaning up the worktree or handing off the next blueprint, read this reference.

Use `${BOUNCER_ROOT}/rules/acq.md` for the shared ACQ display and chat fallback; this reference
does not open an ACQ of its own.
Use `${BOUNCER_ROOT}/rules/current-pointer.md` for pointer clear and confirm-then-set
invariants; this reference applies the finalize next-blueprint exception there.

**Plugin-root shell contract.** See `${BOUNCER_ROOT}/rules/plugin-root.md`; the main-worktree cleanup shell below remains independent.

After `--yes`, run cleanup from the main worktree, not a checkout you are removing.

**Drive release.** From the main worktree run `bouncer finalize release-main --blueprint <pointer.blueprint>` before touching any worktree. `<pointer.blueprint>` is the blueprint value you passed to `finalize --yes` (the pointer is cleared by then). On `ok: true`, report `removed`, `restored`, and `preserved`. Then take the list from the finalize payload's `worktrees` field rather than re-deriving it and `git worktree remove --force` each path: remove the worker worktrees first, then the integration one, so a failure never orphans a worker under a removed parent. Report every path the removal did not clear.

On `ok: false`, report `reason` and leave the worktrees and the ledger; do not run step 5 `--set`.

**Detached run.** A ledger with `status: detached` (from `bouncer run detach`, which the user approved after a Git merge) is still a preserved drive: its ledger and worktrees are untouched and its pointer key was removed. If the user finalizes it, they first run `bouncer current --set <blueprint>`; `release-main` and `finalize` judge it by the same rules as any ledger (every task `integrated`). Detach itself is neither verification nor finalize, so do not report it as either.

**Drive inventory.** A coordinator drive leaves one integration worktree and one worker worktree per prepared task. Preserve the whole inventory — and the ledger inside the integration worktree — whenever the drive stopped as blocked, a task is still open, or the integration head is unverified: those checkouts are the recovery state, not leftovers. Cleanup is for a closed blueprint only. A terminal task that `finalize --yes` accepted as a valid `outside_scope` classification counts as closed: `release-main` cleans that drive and reports `outside_scope` (`task`, `evidence_id`, `reason`) in its payload, so carry it into the report. A `drive-not-closed` refusal from `release-main` yields the same preservation; report its `cause` and `next` (and the `tasks` it lists).

Resolve `worktreePathFor` for a single execute checkout, always with `--force`:
```bash
WORKTREE_PATH="$(node -e "process.stdout.write(require('$(bouncer-root --auto)/scripts/lib/runtime-state').worktreePathFor({repoRoot:process.cwd(),blueprint:'<pointer.blueprint>'}))")"
git worktree remove --force "${WORKTREE_PATH}"
if [ "$(basename "$(dirname "$(dirname "${WORKTREE_PATH}")")")" = ".worktrees" ]; then rmdir "$(dirname "${WORKTREE_PATH}")" 2>/dev/null || true; fi
```

Then read `next` from the `release-main` JSON. If `next` is non-null, from the main worktree run `bouncer current --set <next.blueprint>` without asking, using `next.blueprint`. Pointer keys are location-based, so this `--set` must run at the base checkout or the next `/bouncer-run` will not see it. If the plan gate refuses, leave the pointer cleared and report the failure code; do not try another candidate. If `--set` returns `CURRENT_WOULD_BE_AMBIGUOUS`, do not ask and do not retry with `--replace` or `--keep-others`: report the code and stop, leaving the pointer as it is. If `next` is `null`, say the pointer is cleared and tell the user to run `/bouncer-plan`. Do not `--set` a blueprint other than that `next`.
