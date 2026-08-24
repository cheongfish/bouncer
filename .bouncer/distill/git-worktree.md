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

Rules routed to git-worktree; routing remains disabled until the project explicitly opts in.

## Invariants

## Gotchas

- `git worktree add` checks out every tracked file at its HEAD blob — the
  destination is never empty, so "the file is already there" does not mean
  someone else wrote it; compare against the HEAD blob (`git cat-file --filters
  HEAD:<path>`, which respects autocrlf) before calling it a conflict.

- Finalize empty-epic cleanup `rmdir`s only when the removed worktree path is
  nested (grandparent basename is `.worktrees`). After a flat
  `.worktrees/<bp-id>` reuse, never `rmdir` the `.worktrees` root.

- Linked execute checkout cwd can lack Distill; resolve main worktree with
  `bouncer project-root` before any Distill Read/Write — do not re-derive Git
  main-root in skill prose.

- `git checkout -- <path>` restores from the index, so it silently leaves a
  staged change in place; name HEAD (`git checkout HEAD -- <path>`) to reset the
  index and working tree together.

- `git diff --name-only HEAD` reports staged changes and deletions too — feeding
  its output straight into a file read throws on any deleted path.

- The commit-safety hook runs the **installed plugin cache** code against the
  shell cwd at PreToolUse time. A task that changes the document layout inside
  this repo therefore hits a released resolver that cannot read the new layout,
  `affected_paths` resolves to `[]`, and every commit in the execute worktree is
  blocked as out-of-scope. Verify scope with the worktree's own
  `readAffectedPaths` before working around it.

- `finalize` nests the whole `nextBlueprint` return under `next`, so the
  candidate is `next.next` and overlap is `next.next.sharedPaths` — a flat
  `next.sharedPaths` read skips the handoff warning.

## Decisions

- `/bouncer-finalize` step 4 keeps a single Draft PR ACQ. After accept, show the
  rendered title/body then push + `gh pr create --draft` with no second
  body-confirm. If push or `gh` fails, keep the local commit and report the
  reason — do not re-ask the PR ACQ.

- The next blueprint after finalize is a computation (`listReadyBlueprints` +
  epic `## Blueprints` order), not stored state; advancing the pointer is
  confirm-then-`bouncer current --set` only — never automatic and never a new
  CLI. `listReadyBlueprints` includes only blueprint `approved` with at least
  one task document `ready` / `in_progress` (`verified` excluded); broken docs
  are skipped per entry. `bouncer current --set` writes the pointer only after
  the plan gate passes; failures ship `validateBlueprint` results untouched and
  leave the pointer alone. Pointer absence is a state, not an error: bare
  `bouncer current` always exits `0` and attaches `ready` only when the pointer
  is null.

- Plan artifacts reach the execute worktree through `bouncer seed-worktree`, run
  in the base checkout right after `git worktree add`; the moved set is the plan
  context documents only, and the base is returned to HEAD.

- Execute worktree paths come from `runtime-state.worktreePathFor({ repoRoot,
  blueprint })`: `<repo>/.worktrees/<epic-id>/<bp-id>` (ids from `parsePathIds`
  on the blueprint dir). If the nested path is missing and a flat
  `<repo>/.worktrees/<bp-id>` already exists as a directory, reuse that flat
  path — do not rename or migrate. `ensureWorktreeRoot` is removed; skills must
  not assemble the path themselves. The `.worktrees` root stays under the main
  worktree from `git-common-dir`, not the host XDG state home. Migrate never
  renames worktree directories or branches that still carry legacy `BP-` tokens
  — leave them through finalize.

- `isUnder` / `RUNTIME_ARTIFACTS` / `isRuntimeArtifact` / `makeAllowed` live in
  `scripts/src/lib/scope.ts` so `validate` does not require `finalize` (cycle).
  `finalize` / `commit` / `commit-guard` / `seed-worktree` import from there.

- Closed-blueprint rejection lives in `scaffoldTask` as a throw; `cli.ts` gets
  no new branch because its existing catch already renders `scaffold: <message>`
  + exit 2. The message names the closure and points at opening a new blueprint.

