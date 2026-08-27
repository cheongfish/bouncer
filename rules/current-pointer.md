# Current pointer

All workflows use the `bouncer current` CLI surface to read, set, or clear the
active pointer. Never read or write the pointer file directly, call
`scripts/lib/current`, reconstruct a blueprint/task path, or infer a candidate
that the CLI did not return.

## Read and task selection

Run `node "${BOUNCER_ROOT}/scripts/bouncer" current`. A `null` result has no
active blueprint: the consumer keeps its local stop reason, but must not invent
a pointer. For a non-null result, use returned `blueprint` verbatim for every
document read and `--blueprint` argument. Use `current.task.path` verbatim as
the task brief when present. Only when `current.task` is null may the existing
first/single task resolver select a `tasks/<NNN>/tasks.md` bundle; retain that
one result for the rest of the workflow step.

The pointer is shared through the Git common directory. Main and execute
worktrees therefore observe the same CLI result; do not copy or synchronize a
pointer into either checkout.

## Moves and clears

Use `bouncer current --set <blueprint> [--task <NNN>]` only with the CLI value
that names the selected blueprint or task. `--set` runs the plan gate and must
be allowed to refuse the move; never bypass that gate. Initial blueprint setup
after plan approval and every next-blueprint handoff require their own user
confirmation before `--set`; they are never automatic. Clearing is owned by
`bouncer finalize --yes`; workflows do not write a replacement empty pointer.

For next tasks, `/bouncer-commit` requires confirm-then-set. `/bouncer-run`
uses the commit payload's `nextTask`: its start ACQ pre-authorizes `auto`
next-task moves, while `interactive` asks again at each task boundary before
`--set`. These exceptions never authorize a next-blueprint move.
