# CLI operating contract

Use the shipped `bouncer` command, not ad-hoc filesystem or Git substitutes.
Most commands accept `--repo <dir>` when they must target another repository;
`coordinate revise` deliberately does not, because it writes only in the
assigned worker worktree. Write commands always obey the controller-assigned
actual write cwd.

This file is the index. Each command contract is written once, in the stage document
that the calling step reads. Read the document for the stage you are in.

| Stage | Read | Covers |
| --- | --- | --- |
| Plan, task authoring, validate, verify, commit, finalize, metrics, plan ledger, review record | `${BOUNCER_ROOT}/rules/cli-workflow.md` | `init`, `plan`, `validate`, `verify`, `execute prepare`, `commit`, `finalize`, `scaffold`, `epic`, `review record`, `review accept-risk`, `metrics`, `plan-ledger` |
| Run preflight and detach, pointer, worktree, coordinator drive, final-review repair | `${BOUNCER_ROOT}/rules/cli-coordinate.md` | `run`, `current`, `seed-worktree`, `coordinate` |
| Read-only discovery, Graphify, model resolution, review dispatch, context review, print dispatch | `${BOUNCER_ROOT}/rules/cli-discovery.md` | `project-root`, `intent`, `graphify-bin`, `graph-sync`, `subagent-model`, `config`, `retro`, `codex-agents`, `review-dispatch`, `context-review`, `dispatch print` |
| Removed light mode recovery, controlled migrations, import | `${BOUNCER_ROOT}/rules/cli-migration.md` | `migrate`, `import` |

## Result handling

Exit code `0` means the command completed, `1` is an operational or gate
failure, and `2` is invalid usage. Consume structured stdout where a command
returns JSON. When a `validate` failure item includes `next`, that sentence is
the recovery action — follow it instead of reading validator sources.
A `validate` result carries `gates[]` only when G failures exist; render it
first, and use the gate's single `next` as the recovery action (the first non-empty
`next` among that gate's failures, or the gate's default sentence when none has one). Check each
individual failure through `failures[]` `code` and `next`. `current --set`,
`commit`, and `finalize` failure payloads carry the same `gates`. The `gate`
field on a commit or coordinate failure is for display only; `reason` is what
decides. Do not
infer success from prose, partial output, or a command that returned a
non-zero exit code.
