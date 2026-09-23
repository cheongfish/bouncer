# CLI operating contract

Use the shipped `bouncer` command, not ad-hoc filesystem or Git substitutes.
Most commands accept `--repo <dir>` when they must target another repository;
`coordinate revise` deliberately does not, because it writes only in the
assigned worker worktree. Write commands always obey the controller-assigned
actual write cwd.

## Normal workflow commands

```sh
bouncer init [--upgrade-graphify]
bouncer plan inspect [--epic-dir <dir>]
bouncer validate --blueprint <dir> --gate <plan|execute|commit|finalize>
bouncer verify --blueprint <dir>
bouncer execute prepare --blueprint <dir>
bouncer commit --blueprint <dir> [--yes]
bouncer finalize --blueprint <dir> [--yes]
bouncer run preflight --blueprint <dir>
```

`validate` decides gate success. `verify` writes the evidence used by G13.
`execute prepare` creates or reuses the correct standalone worktree; in a
coordinator drive it reports the assigned worker instead. `commit --yes` is
the only normal task-commit command. `finalize --yes` may close the blueprint,
so obtain the workflow-required user consent before calling it.

## Context and task creation

```sh
bouncer scaffold epic --id <ddd> --name <slug> --description <text>
bouncer scaffold blueprint --epic-dir <dir> --id <ddd> --name <slug> [--scale light|full]
bouncer scaffold task --blueprint <dir> --id <NNN> [--execution-kind commit|verification]
bouncer scaffold task --blueprint <dir> --id <NNN> --execution-kind verification \
  --depends-on TASKS-NNN[,TASKS-NNN...] --verify <command>
bouncer scaffold explain --blueprint <dir>
bouncer scaffold context-review --blueprint <dir>
```

IDs are zero-padded three digits. A verification task is terminal: it creates
only `tasks.md` and `verification.md`, runs its declared command in the
integration checkout, and creates neither a source commit nor `review.md`.
Do not scaffold tasks into a closed blueprint.

## Pointer, worktree, and coordinator commands

```sh
bouncer current [--set <dir> [--base <branch>] [--task <NNN|TASKS-NNN>] [--replace]] [--clear]
bouncer seed-worktree --blueprint <dir> --to <worktree>
bouncer coordinate <bootstrap|prepare|ready|record|rerecord|integrate|status|revise|repair|partial-close|critical-recovery|release> --blueprint <dir> ...
```

Do not assemble worktree paths or edit the pointer/ledger directly. In a
drive, workers report only from their assigned worktree; the coordinator owns
pointer moves, scope revisions, result recording, fan-in, repair, and release.
Use `coordinate revise` only from the assigned worker worktree with a reason
and explicit source paths. A `partial-close` requires the workflow's explicit
user confirmation and is unresolved handoff, not ordinary completion.

## Read-only discovery and Graphify

```sh
bouncer project-root
bouncer intent --symbol <function-name> [--candidate <qualified-ref>] [--limit <1..5>]
bouncer graphify-bin
bouncer graph-sync
bouncer graph-suggest --query <text> [--seed <value>]... [--debug]
bouncer review-dispatch plan --blueprint <dir>
bouncer review-dispatch execute --blueprint <dir> --task <ddd> --base <sha> --head <sha>
```

Use `project-root` to locate the consuming repository from linked worktrees.
Resolve Graphify through `graphify-bin`; never invoke a bare guessed binary.
Graph absence is a reported state, not permission to invent graph results.

`review-dispatch` is read-only. It returns JSON for Plan (`skip | single |
clustered`) or Execute (`single | parallel`, with `security` when
`review_risk` is non-empty). On structural or input failure it prints
`{ ok: false }` without a reviewer list (exit 1). Plan dispatch also returns
`{ ok: false }` with `plan draft validation failed` and the plan-gate
`failures` (G5, G10–G12, G19, G20) when the draft fails. Invalid argv is exit 2.
Do not invent a strategy when the command fails.

## Controlled migrations

```sh
bouncer migrate task-layout [--dry-run]
bouncer migrate retention
bouncer migrate retention --apply --blueprint <dir>
bouncer import [--source merges|commits] [--since <ref>] [--limit <n>] \
  [--epic-id <ddd>] [--epic-name <slug>] [--yes --message <msg>]
```

Inspect dry-run output before any write. Retention's default is an audit;
`--apply` modifies one eligible closed blueprint and deletes transient files.
`import` is dry-run unless both `--yes` and `--message` are present.

## Result handling

Exit code `0` means the command completed, `1` is an operational or gate
failure, and `2` is invalid usage. Consume structured stdout where a command
returns JSON. Do not infer success from prose, partial output, or a command
that returned a non-zero exit code.
