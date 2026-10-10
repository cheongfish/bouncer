# CLI operating contract

Use the shipped `bouncer` command, not ad-hoc filesystem or Git substitutes.
Most commands accept `--repo <dir>` when they must target another repository;
`coordinate revise` deliberately does not, because it writes only in the
assigned worker worktree. Write commands always obey the controller-assigned
actual write cwd.

## Normal workflow commands

```sh
bouncer init [--upgrade-graphify]
bouncer plan inspect [--epic-dir <dir>] [--blueprint <dir>]
bouncer validate --blueprint <dir> --gate <plan|execute|commit|finalize>
bouncer verify --blueprint <dir>
bouncer execute prepare --blueprint <dir>
bouncer commit --blueprint <dir> [--yes]
bouncer finalize --blueprint <dir> [--yes]
bouncer finalize release-main --blueprint <dir>
bouncer run preflight --blueprint <dir>
```

`plan inspect` prints next ids, verify signals, and pointer state as JSON.
With `--blueprint <dir>` it also fills advisory `routing` (task/dependency/
module/risk signals and a light/full recommendation); without that flag
`routing` is `null`. The signal does not select or approve light.
`validate` decides gate success. `verify` writes the evidence used by G13.
`execute prepare` creates or reuses the correct standalone worktree; in a
coordinator drive it reports the assigned worker instead. `commit --yes` is
the only normal task-commit command. `finalize --yes` may close the blueprint,
so obtain the workflow-required user consent before calling it.
Right after the verify command resolves, `finalize --yes` runs
`npm ci --include=dev --ignore-scripts --no-audit --no-fund` once in the same
checkout when `package-lock.json` exists and `node_modules/.package-lock.json`
does not; npm output is captured and never reaches the JSON stdout. Dry-run,
an empty close, config errors, and gate or scope refusals never install. An
install failure exits 1 with `code: DEPENDENCY_INSTALL_FAILED`, `cause`, and
`next` before verify, staging, commit, or pointer clearing — repair the
install in that checkout as `next` says, then rerun the same finalize command.
`VERIFY_FAILED` still means only that verify failed after dependencies were ready.
`finalize release-main --blueprint <dir>` is main-checkout-only: it cleans
main plan copies after a closed drive.

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
bouncer coordinate <bootstrap|prepare|ready|dispatch|report|record|rerecord|revoke|integrate|status|revise|repair|partial-close|critical-recovery|next|advance|promote-stop> --blueprint <dir> ...
bouncer coordinate status --blueprint <dir> --write-input <file>
bouncer coordinate advance --blueprint <dir> [--task <ddd>] [--max-steps <n>]
bouncer coordinate promote-stop --blueprint <dir> \
  --reason <security-risk|out-of-scope|task-split|interface-semantics|reviewer-wider-scope> \
  --summary <text>
bouncer coordinate repair --blueprint <dir> --task <ddd> --failure-command <cmd> \
  --summary <text> --paths <p> --decision <reason>
bouncer coordinate repair --blueprint <dir> [--task <ddd>] --review-finding <id> \
  [--review-finding <id>]... --summary <text> --paths <p> --decision <reason>
bouncer coordinate repair --blueprint <dir> --kind supplement --review-finding <id> \
  [--review-finding <id>]... --summary <text> --paths <test-path>
bouncer coordinate repair --blueprint <dir> --kind supplement --done --summary <text>
```

`coordinate status` checkpoints carry `executor_observation`
(`{ state: 'unknown', source: 'unavailable', reason: 'executor-state-not-tracked' }`),
a read-only projection that is never stored in the ledger. The CLI does not
track host executors, so a task `dispatch.status: active` (recorded before the
host launch) and a changed `ledger.sha256` (fencing token only) are not proof a
worker is running or made progress; only the root session's real host handle
can show running or terminated.

Do not assemble worktree paths or edit the pointer/ledger directly. In a
drive, workers report only from their assigned worktree; the coordinator owns
pointer moves, scope revisions, result recording, fan-in, and repair.
`coordinate` stdout is one-line JSON; a success response carries `checkpoint`
(and prepare also `opened[]`) instead of ledger copies of `tasks` or
`decisions`.
`coordinate bootstrap` sets ledger `mode: light` only when blueprint
`bouncer.scale` is `light` and the blueprint has exactly one commit task with
an empty `depends_on`; otherwise a light scale is refused with
`light-requires-single-task`. Light prepare assigns `workerPath` to the
integration worktree (no worker worktree), `coordinate next` implement carries
`payload.inline: true`, and integrate records fan-in verified without
cherry-pick. Light `report --outcome accepted` requires blueprint-root
`review.md` rounds from `bouncer review record` and document status `accepted`
(`light-review-required` otherwise). A resume bootstrap against the opposite
mode fails with `ledger-mode-mismatch`. Ledgers without `mode` read as full.
`coordinate promote-stop` (light only) records `status: promotion_stopped` and
a `promotion` snapshot (`reason`, `summary`, open task, `diff_sha`, optional
evidence ids). Reasons are `security-risk`, `out-of-scope`, `task-split`,
`interface-semantics`, `reviewer-wider-scope`. Same reason+summary is
idempotent; afterward `prepare`/`dispatch`/`report`/`record`/`integrate` and
`run preflight` delegation fail with `promotion-stopped`. There is no resume —
full replan needs a new `bootstrap` and `current --set`.
`coordinate advance` runs deterministic `next` argv actions (`prepare`,
`integrate`, `verification_node`, `verify`, `commit`) and stops at `judge`,
`worker`, `blocked`, `done`, `none`, `max-steps`, or a failure
(`repeated-failure`, `unclear-result`, `advance-argv-invalid`, or the
automatic action's reason).
When a `coordinate` JSON response has `ok: false`, follow its `next` and do
not recover by reading plugin sources.
Use `coordinate revise` only from the assigned worker worktree with a reason
and explicit source paths. A `partial-close` requires the workflow's explicit
user confirmation and is unresolved handoff, not ordinary completion.

## Read-only discovery and Graphify

```sh
bouncer project-root
bouncer intent --symbol <function-name> [--candidate <qualified-ref>] [--limit <1..5>]
bouncer intent bundle --task <tasks.md> --symbol <name>... [--candidate <qualified-ref>]...
bouncer intent sections --task <tasks.md> --role <implementer|reviewer|debugger>
bouncer graphify-bin
bouncer graph-sync
bouncer graph-suggest --query <text> [--seed <value>]... [--debug]
bouncer subagent-model --agent <name> [--provider <name>]
bouncer config --help
bouncer codex-agents check --agent <name>
bouncer review-dispatch plan --blueprint <dir> [--previous <file>]
bouncer review-dispatch execute --blueprint <dir> [--task <ddd>] --base <sha> --head <sha>
  # light scale → strategy single / perspectives [combined] (diff size ignored);
  # non-empty review_risk still appends security
bouncer dispatch print --role <implementer|reviewer|debugger|context-reviewer|coordinator> \
  --cwd <dir> --input <file> --out <dir> [--repo <dir>]
```

Use `project-root` to locate the consuming repository from linked worktrees.
Resolve Graphify through `graphify-bin`; never invoke a bare guessed binary.
Graph absence is a reported state, not permission to invent graph results.

`intent bundle` creates or reuses the task intent cache. `intent sections` is
read-only: it projects role-specific section bodies from that cache. On
`{ ok: false }`, `reason` is `intent-bundle-missing`, `intent-bundle-stale`,
`intent-sections-drift`, or `intent-task-invalid` (exit 1). For the first three,
follow `next` and run `bouncer intent bundle --task <path> --symbol <name>...`
to rebuild, then retry sections. For `intent-task-invalid`, do not rebuild the
bundle; correct `--task` to the canonical `tasks.md` path shown in `next` and
retry sections. Do not assemble `intent_sections` by reading bundle sources.

`subagent-model` prints one model slug, or `inherit`. Pass only that line into
named dispatch; omit the model argument when the line is `inherit`. Do not
parse it as `{ model, provider }` JSON. `codex-agents check` is read-only: it
prints `{ ok, agent, in_sync, path }` and, on drift, `reason` plus
`next: "bouncer init --seed-codex-agents"` (exit 1). Compact a named
implementer payload only when `in_sync` is true. Invalid `--agent` or a verb
other than `check` is exit 2.

`review-dispatch` is read-only. It returns JSON for Plan (`skip | single |
clustered`) or Execute (`single | parallel`, with `security` when
`review_risk` is non-empty). Plan `single` / `clustered` also include
`parts` (per-document body sha256), `scope_parts` (per-`tasks.md` scope
sha256), `follow_up` (`full` | `partial`), and `changed_documents`. Pass
`--previous <file>` (a prior plan JSON with `parts`) to compare; omit it for
`follow_up: full` and an empty `changed_documents`. Those fields are absent
on `skip` and on failures. Invalid `--previous` (missing file, non-JSON, or
no `parts`) is `{ ok: false, reason: "previous-payload-invalid" }` (exit 1);
`--previous` without a path is exit 2. Omit `--task` on execute to classify
the whole `base..head` diff and the union of commit-task `review_risk`
(`target.task` is then `null`). On structural or input failure it prints
`{ ok: false }` without a reviewer list (exit 1). Plan dispatch also returns
`{ ok: false }` with `plan draft validation failed` and the plan-gate
`failures` (G5, G10–G12, G19, G20) when the draft fails. Invalid argv is exit 2.
`dispatch print` runs one Cursor print process. It returns JSON for success
(`ok: true` with `report`) or `{ ok: false, reason, cause, next }` (exit 1).
`reason` is `print-dispatch-disabled`, `agent-unavailable`,
`agent-exit-nonzero`, `result-missing`, `result-error`,
`dispatch-input-invalid`, or `role-document-invalid`. Follow `next`; do not
assemble the identity line, role body, or `agent --print` argv in the
session. Invalid argv (`print` missing, unknown `--role`, duplicate or
missing `--role`/`--cwd`/`--input`/`--out`) is exit 2.

```sh
bouncer review record --blueprint <dir> [--task <ddd>] --round <json-file> [--status <requested|addressed|accepted>]
```

`review record` writes one round and finding updates into `review.md`
frontmatter only after the same finding/round checks as G21 and G14 pass.
Success is `{ ok: true, path, round, status, findings }` (exit 0). Failure is
`{ ok: false, reason, cause, next }` (exit 1) and leaves the file unchanged.
`reason` is `review-target-missing`, `review-task-required`,
`review-task-not-allowed`, `review-input-invalid`,
`review-round-out-of-sequence`, or `review-ledger-invalid`. Follow `next`; do
not edit YAML by hand or read validator sources to invent a passing
frontmatter. Invalid argv (`record` missing, `--blueprint`/`--round` missing,
duplicate options, `--task` not three digits, `--status` outside
`requested|addressed|accepted` including `pending`) is exit 2.

```sh
bouncer dispatch print --role <implementer|reviewer|debugger|context-reviewer|coordinator> \
  --cwd <dir> --input <file> --out <dir> [--repo <dir>]
```

Do not invent a strategy when the command fails. `coordinate repair` takes
either `--failure-command` (terminal CI) or repeated `--review-finding`
(final-review must_fix), never both. Omit `--task` on the review-finding form
when the blueprint has no terminal verification task. `--kind supplement`
accepts an in-scope test-evidence gap without a new task or repair wave (test
paths inside an integrated task's `affected_paths`, no delta round yet);
`--done` verifies it, and the next final review is the one delta round.
`--kind` accepts only `product` (default) or `supplement`.

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
returns JSON. When a `validate` failure item includes `next`, that sentence is
the recovery action — follow it instead of reading validator sources. Do not
infer success from prose, partial output, or a command that returned a
non-zero exit code.
