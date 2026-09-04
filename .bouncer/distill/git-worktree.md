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

- `git worktree add` checks out every tracked file at HEAD — "already there" is not a conflict. Compare against HEAD blob before calling it a conflict.
- Linked execute checkout cwd can lack Distill; resolve with `bouncer project-root` before Distill Read/Write.
- Commit-safety hook runs **installed plugin cache** code. A layout-changing task can yield `affected_paths = []` and block every worktree commit — verify with the worktree's own `readAffectedPaths`.
- After flat `.worktrees/<bp-id>` reuse, never `rmdir` the `.worktrees` root.

## Decisions

- Next blueprint after finalize is a computation, not stored state; pointer advance is confirm-then-`bouncer current --set` only — never automatic.
- Execute path is `<repo>/.worktrees/<epic-id>/<bp-id>`. If nested missing and flat `<repo>/.worktrees/<bp-id>` exists, reuse flat. Skills must not assemble the path.
