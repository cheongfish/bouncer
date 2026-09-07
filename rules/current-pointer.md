# Current pointer

All workflows use the `bouncer current` CLI surface to read, set, or clear the
active pointer. Never read or write a pointer file directly, call
`scripts/lib/current`, reconstruct a blueprint/task path, or infer a candidate
that the CLI did not return.

## Read and task selection

Run `node "${BOUNCER_ROOT}/scripts/bouncer" current`. Selection is location-based
and uses only that CLI result:

- From a nested execute worktree (`.worktrees/<epic-id>/<blueprint-id>`), or from
  a uniquely corresponding legacy flat worktree (`.worktrees/<blueprint-id>`),
  the CLI returns the worktree-local namespace pointer.
- From the base checkout, the CLI returns the pointer only when exactly one
  namespace key is present.
- Multiple candidates at base, or a flat worktree that matches more than one
  key, yield `CURRENT_AMBIGUOUS` with sorted `{ blueprint, base, task }`
  candidates. Stop. Do not pick a candidate, and do not treat this result as
  `null`.
- A legacy file that disagrees with namespace keys, or an unreadable pointer
  file, yields `CURRENT_INVALID`. Stop without recovery.

A `null` result has no selected blueprint: the consumer keeps its local stop
reason, but must not invent a pointer. For a non-null result, use returned `blueprint` verbatim for every document read and `--blueprint` argument. Use
`current.task.path` verbatim as the task brief when present. Only when
`current.task` is null may the existing first/single task resolver select a
`tasks/<NNN>/tasks.md` bundle; retain that one result for the rest of the
workflow step.

The CLI stores namespace keys under the Git common directory as
`pointers/<epic-id>/<blueprint-id>.json` with body `{ blueprint, task?, base }`.
Linked worktrees share that directory, so other namespace pointers may exist
beside the one this cwd selected. When the result is `selected`, compact
workflow output states the selected `{ blueprint, task, base }` and that
shared possibility in one sentence. When the result is `null`, say there is
no selection. Emit the raw JSON only when the user asks for `debug`. Do not
copy or synchronize a pointer into either checkout.

## Moves and clears

Use `bouncer current --set <blueprint> [--task <NNN>]` only with the CLI value
that names the selected blueprint or task. Default `--set` adds or updates that
namespace key and leaves other keys in place. `--replace` deletes the uniquely
selected key, then writes the target; at a multi-pointer base it returns
`CURRENT_AMBIGUOUS` and changes nothing. `--set` runs the plan gate and must be
allowed to refuse the move; never bypass that gate. Initial blueprint setup
after plan approval and every next-blueprint handoff require their own user
confirmation before `--set`; they are never automatic.

`--clear` (owned by `bouncer finalize --yes`) removes only the currently
selected key. Workflows do not write a replacement empty pointer, and they do
not clear every namespace key in the Git common directory.

The legacy file `bouncer/current` remains readable. The first successful
`--set` migrates it into the target namespace key and deletes the legacy file
when the two agree. When they name different blueprints, the CLI reports
`CURRENT_INVALID` and leaves both unchanged.

For next tasks, `/bouncer-commit` requires confirm-then-set. `/bouncer-run`
uses the commit payload's `nextTask`: its start ACQ pre-authorizes `auto`
next-task moves, while `interactive` asks again at each task boundary before
`--set`. These exceptions never authorize a next-blueprint move.
