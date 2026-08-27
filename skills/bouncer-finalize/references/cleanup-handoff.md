After the remainder choice, when cleaning up the worktree or handing off the next blueprint, read this reference.

Use `rules/acq.md` for the shared ACQ display and chat fallback; this reference
only defines the cleanup and handoff choices below.
Use `rules/current-pointer.md` for pointer clear and confirm-then-set
invariants; this reference applies its next-blueprint handoff only.

**Plugin-root shell contract.** See `rules/plugin-root.md`; the main-worktree cleanup shell below remains independent.

After the PR branch, apply the step-3 choice without re-asking. For remove (A), run from the main worktree, not the execute checkout; add `--force` only after dirty-tree warning ACQ. Resolve `worktreePathFor`, run `git worktree remove`, then only `rmdir` an empty nested epic parent when the grandparent basename is `.worktrees`; never remove the `.worktrees` root for reused flat paths. Keep the feature branch unless asked to delete it. For keep (B), report its path.
```bash
BOUNCER_ROOT="$(bouncer-root --auto)" || exit $?
WORKTREE_PATH="$(node -e "process.stdout.write(require('${BOUNCER_ROOT}/scripts/lib/runtime-state').worktreePathFor({repoRoot:process.cwd(),blueprint:'<pointer.blueprint>'}))")"
git worktree remove "${WORKTREE_PATH}"
if [ "$(basename "$(dirname "$(dirname "${WORKTREE_PATH}")")")" = ".worktrees" ]; then rmdir "$(dirname "${WORKTREE_PATH}")" 2>/dev/null || true; fi
```

Then use `next.next` and `next.sameEpicPending` from finalize `--yes` JSON (or dry-run when nothing committed). If both are empty, skip. List pending siblings; `ready: false` entries are `/bouncer-plan`. draft 형제에 `--set`을 제안하지 않는다. If `next.next` is non-null, show its blueprint, sameEpic, remaining count, warn on `next.next.sharedPaths`, and warn a kept worktree will enforce *new* `affected_paths`. If `next.next` is `null` but `sameEpicPending` exists, show pending and do not offer `--set`.

Only with non-null `next.next`, ACQ: A) `bouncer current --set <next.blueprint>` (recommended), B) show command and leave pointer cleared, C) cancel. Apply the shared confirm-then-set and plan-gate contract; no next-task ACQ exists here. On A run `node "${BOUNCER_ROOT}/scripts/bouncer" current --set <next.blueprint>` using `next.next.blueprint`. A plan-gate refusal is reported but does not undo successful finalize.
