---
distill:
  id: git-worktree
  paths:
    - .worktrees/**
    - scripts/src/lib/seed-worktree.ts
    - scripts/src/lib/runtime-state.ts
    - scripts/src/lib/scope.ts
    - scripts/src/lib/commit-hook.ts
  pulls: []
---
# git-worktree

## Invariants

## Gotchas

- `git worktree add` checks out every tracked file at HEAD - destination is never empty; "already there" is not a conflict. Compare against HEAD blob (`git cat-file --filters HEAD:<path>`, respects autocrlf) before calling it a conflict.
- Finalize empty-epic cleanup `rmdir`s only when removed worktree path is nested (grandparent basename `.worktrees`). After flat `.worktrees/<bp-id>` reuse, never `rmdir` the `.worktrees` root.
- Linked execute checkout cwd can lack Distill; resolve main worktree with `bouncer project-root` before Distill Read/Write.
- `git checkout -- <path>` restores from index and silently leaves staged changes; name HEAD (`git checkout HEAD -- <path>`) to reset index and working tree together.
- `git diff --name-only HEAD` reports staged changes and deletions - feeding it into a file read throws on deleted paths.
- Commit-safety hook runs **installed plugin cache** code against shell cwd at PreToolUse. A layout-changing task in this repo hits a released resolver that cannot read the new layout -> `affected_paths` = `[]` -> every execute-worktree commit blocked out-of-scope. Verify with worktree's own `readAffectedPaths` before working around it.
- `finalize` nests `nextBlueprint` under `next`, so candidate is `next.next` and overlap is `next.next.sharedPaths` - flat `next.sharedPaths` skips the handoff warning.

## Decisions

- `/bouncer-finalize` step 4 keeps a single Draft PR ACQ. After accept, show rendered title/body then push + `gh pr create --draft` with no second body-confirm. Push/`gh` failure keeps local commit and reports reason - do not re-ask PR ACQ.
- Next blueprint after finalize is a computation (`listReadyBlueprints` + epic `## Blueprints` order), not stored state; pointer advance is confirm-then-`bouncer current --set` only - never automatic, never a new CLI. `listReadyBlueprints` includes only blueprint `approved` with >=1 task `ready`/`in_progress` (`verified` excluded); broken docs skipped per entry. `--set` writes only after plan gate passes; failures leave pointer alone. Pointer absence is a state: bare `bouncer current` exits `0` and attaches `ready` only when pointer is null.
- Plan artifacts reach execute worktree via `bouncer seed-worktree` in the base checkout right after `git worktree add`. Requires **both** `--blueprint <dir>` and `--to <worktree>`; either alone exits 2. Moved set = plan context docs only; base returns to HEAD.
- Execute paths from `runtime-state.worktreePathFor({ repoRoot, blueprint })`: `<repo>/.worktrees/<epic-id>/<bp-id>` (ids from `parsePathIds` on blueprint dir). If nested missing and flat `<repo>/.worktrees/<bp-id>` exists as a directory, reuse flat - do not rename/migrate. `ensureWorktreeRoot` removed; skills must not assemble the path. `.worktrees` root stays under main worktree from `git-common-dir`, not XDG. Migrate never renames worktree dirs/branches still carrying legacy `BP-` tokens.
- `isUnder` / `RUNTIME_ARTIFACTS` / `isRuntimeArtifact` / `makeAllowed` live in `scripts/src/lib/scope.ts` so `validate` does not require `finalize` (cycle). `finalize` / `commit` / `commit-guard` / `seed-worktree` import from there.
- Closed-blueprint rejection is a throw in `scaffoldTask`; `cli.ts` gets no new branch - existing catch renders `scaffold: <message>` + exit 2.
