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
bouncer plan approve --blueprint <dir> [--repo <dir>]
bouncer validate --blueprint <dir> --gate <plan|execute|commit|finalize>
bouncer verify --blueprint <dir>
bouncer execute prepare --blueprint <dir>
bouncer commit --blueprint <dir> [--yes]
bouncer finalize --blueprint <dir> [--yes]
bouncer finalize release-main --blueprint <dir>
bouncer run preflight --blueprint <dir>
bouncer run detach --blueprint <dir> --yes [--reason <text>]
```

`run preflight` success payloads carry `shape`: `drive_shape` (`serial` when
every simulated wave has width 1, `parallel` for a single wave of width 2+,
`mixed` otherwise, `null` with no open commit task, `unknown` when the
simulation cannot open the remaining tasks), `max_wave_width`, `commit_tasks`,
`review_risk` (sorted union over open commit tasks) and `parallel_safe_tasks`.
It simulates `readyWave` over open commit tasks only; verification nodes and
edges to them are ignored. Failure payloads omit `shape`.

`run preflight` refuses in this order: (1) `ok:false` with a `CURRENT_*`
selection error, (2) `ok:false` `no-current`, (3) `ok:false` `pointer-mismatch`
with `expected` (the pointer blueprint) and `actual` (the `--blueprint` input,
`toPosix` only) when the `--blueprint` input, normalized to a repo-relative POSIX path with
no trailing slash, differs from the normalized pointer blueprint, resolves
outside the repo, or (when it exists) its realpath is outside the repo realpath,
(4) `delegable:false` from the ledger status: `promotion-stopped`,
`awaiting-confirmation`, `partial-closed`, `run-detached`, (5) `delegable:false` from the
blueprint document status when it is not `approved`: `blueprint-closed`,
`blueprint-partial-closed`, `blueprint-draft`, `blueprint-superseded`,
`blueprint-imported`, `blueprint-status-unknown`, (6) `delegable:false`
`no-open-task`. Every `delegable:false` refusal also has `direct_eligible:false`.

`run detach` closes out a drive whose implementation was already merged by Git
but whose integration ledger still blocks main-checkout commits with
`main-worktree-source-write`. Run it in the main checkout only after the user
approves. It keeps the ledger file, integration and worker worktrees, and
branches; appends one `detached` decision (`at`, `reason`, `integration_head`,
`main_head`, `previous_status`; heads are observations, not merge proof) and sets
ledger `status: detached`; and removes only this blueprint's pointer key.
Success prints `{ ok, ledger, pointer_removed, next }`; a second run is a
no-op with `already: true`. It writes no verification, review, or task status
and is not a finalize. Refusals (exit 1, ledger and pointers unchanged, except
`ledger-lock-lost` below): `detach-confirmation-required` (no `--yes`), `no-ledger`,
`unreadable-ledger`,
`detach-worker-in-flight` (lists task ids whose status is not `integrated` and
whose dispatch is `active`/`reported` or whose status is `prepared`/`recorded`;
an `integrated` task never counts, even though its dispatch stays `reported`),
`detach-awaiting-confirmation`, `ledger-locked` (the ledger lock is held by
another process), and `ledger-lock-lost` (the lock was taken over during the
write). When the lock is lost before the write, nothing changed. When releasing
the lock fails after the write, the ledger and pointer may already be written:
rerun `run detach` and confirm it reports `already: true`. Every refusal is
`{ ok: false, reason, cause, next }`.
A missing `--blueprint` or unknown `run` subcommand exits 2. On a detached
ledger `coordinate next` and every fenced mutation (`prepare`, `dispatch`,
`report`, `record`, `integrate`, `repair`, `revise`, supplement, `session-open`)
refuse with `run-detached`, and worker `revise` write boundaries do too. To
finalize, set the pointer with `bouncer current --set <dir>` and run
`/bouncer-finalize`; finalize rules are unchanged. The
`main-worktree-source-write` refusal (hook message and `commit` `recovery.next`)
carries a `next`: `run detach` when every commit task is `integrated`,
otherwise "work in the execution worktree or continue `/bouncer-run`".

`coordinate prepare` and coordinator task commits compare paths and
`exclusive_resources` with started tasks (`pending` excluded, `integrated`
included) in other active ledgers; detached ledgers are excluded. The drive
that opened its wave first has priority. An overlap is refused as
`cross-drive-conflict` with `conflicts[]` entries containing `blueprint`,
`task`, `paths`, `resources`, and `legacy`. If another ledger cannot be read,
the operation is refused as `cross-drive-ledger-unreadable` with `ledgerFile`.
Wait for the other drive to finalize or detach, or revise the plan to remove
the overlap before retrying.

`plan inspect` prints next ids, verify signals, and pointer state as JSON.
`plan approve --blueprint <dir>` moves epic and blueprint to `approved` and
tasks to `ready` all-or-nothing; run it only after the user approves the
plan. Success prints `{ ok: true, changed, unchanged }` (exit 1 on refusal:
`{ ok: false, reason, cause, next }`, no file changed). Only the
`plan-approve-write` refusal (an I/O failure mid-write) also carries `changed`,
the files already written; rerunning completes the rest. A missing or repeated
`--blueprint` or `--repo` is exit 2.
When `.bouncer/epics.json` is valid and lists the blueprint's epic as `legacy`,
approving a `draft` blueprint is refused with `plan-approve-legacy-epic` (exit 1,
no file changed); plan the blueprint under a registry epic instead. An already
approved blueprint is unaffected.
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
checkout when `package-lock.json` exists and either `node_modules/.package-lock.json`
is missing or `node_modules/.bouncer-lock-sha256` is missing or differs from the
lockfile's sha256 (the stamp is written after a successful install); npm output is captured and never reaches the JSON stdout. Dry-run,
an empty close, config errors, and gate or scope refusals never install. An
install failure exits 1 with `code: DEPENDENCY_INSTALL_FAILED`, `cause`, and
`next` before verify, staging, commit, or pointer clearing — repair the
install in that checkout as `next` says, then rerun the same finalize command.
`VERIFY_FAILED` still means only that verify failed after dependencies were ready;
its payload carries `output_tail`, the last 100 lines or fewer of the verify output.
Worktree dependency preparation (`seed-worktree`, `execute prepare`, finalize)
also runs the optional `worktree.setup` command from the main checkout config
once after the install step. It is one argv (no shell operators) and must pass
`verify_allowlist`; a rejected or failing setup is `dependency-install-failed`
with a message starting `worktree.setup`. `bouncer init` seeds it as
`npm run build` only for a new config whose `package.json` has `scripts.build`;
existing configs are never rewritten.
`finalize release-main --blueprint <dir>` is main-checkout-only: it cleans
main plan copies after a closed drive.

## Context and task creation

```sh
bouncer scaffold epic --name <slug> --description <text>
bouncer scaffold blueprint --epic-dir <dir> --order <n> --name <slug> [--scale light|full] \
  [--area <a>] [--attribution <text>]
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
`scaffold blueprint` under an epic that a valid `.bouncer/epics.json` lists as
`legacy` fails with exit 2 (`legacy epic <id>-<slug> takes no new blueprints;
plan under a registry epic`) before writing any file.
`scaffold epic` accepts only printable ASCII (0x20-0x7E) in the new epic's description and rejects anything else with exit 2.
`scaffold blueprint` takes optional `--area <a>` (an area registered in `.bouncer/epics.json`) and
`--attribution <text>` (why the blueprint belongs to this epic).

## Epic registry commands

```sh
bouncer epic add-domain --slug <s> --reason <text> --yes [--timestamp <iso>]
bouncer epic add-area --name <a> --yes
```

These record a user-approved domain epic or area in `.bouncer/epics.json`.
Run them only after the user explicitly approves; `--yes` carries that approval
and is checked before the registry is read. `add-domain` appends
`{ slug, id, kind: "domain", active: true, approval: { reason, approvedAt } }`
where `id` is the larger of the registry ids and the `.bouncer/context/epics/`
directory numbers plus one (three digits), and `approvedAt` is `--timestamp` or
the current KST time. It creates no directory; the next `/bouncer-plan`
scaffolds it from `plan inspect` `nextEpicId`. Success is
`{ ok: true, path, epic: { slug, id } }` or `{ ok: true, path, area }` (exit 0).
Failure is `{ ok: false, reason, cause, next }` (exit 1, file unchanged) with
`reason` `epic-registry-confirmation-required` (no `--yes`),
`epic-registry-missing`, `epic-registry-invalid`, `epic-registry-domain-limit`
(domain epics already at `domainEpicLimit`), `epic-registry-name-invalid`
(not a kebab-case slug, a common epic slug, or a purpose-style name such as
`performance`), `epic-registry-name-taken`, or `epic-registry-reason-missing`
(blank `--reason`). An unknown subcommand, a missing or duplicate required
flag, or an unknown flag is exit 2.

## Pointer, worktree, and coordinator commands

```sh
bouncer current [--set <dir> [--base <branch>] [--task <NNN|TASKS-NNN>] [--replace] [--keep-others]] [--clear]
bouncer seed-worktree --blueprint <dir> --to <worktree>
bouncer coordinate <bootstrap|prepare|ready|dispatch|report|record|rerecord|revoke|integrate|status|revise|repair|partial-close|critical-recovery|next|advance|session-open|promote-stop|worker-model> --blueprint <dir> ...
bouncer coordinate status --blueprint <dir> --write-input <file>
bouncer coordinate advance --blueprint <dir> [--task <ddd>] [--max-steps <n>]
bouncer coordinate promote-stop --blueprint <dir> \
  --reason <security-risk|out-of-scope|task-split|interface-semantics|reviewer-wider-scope> \
  --summary <text>
bouncer coordinate repair --blueprint <dir> --task <ddd> --failure-command <cmd> \
  --summary <text> --paths <p> --decision <reason> [--verify <argv>] [--new-path <p>]...
bouncer coordinate revise --blueprint <dir> --task <ddd> --paths <p> [--new-path <p>]... \
  --reason <text>
bouncer coordinate repair --blueprint <dir> --task <ddd> --failure-command <cmd> \
  --summary <text> --paths <p> --decision <reason> --resume-task <ddd>
bouncer coordinate repair --blueprint <dir> --task <ddd> --failure-command <cmd> \
  --summary <text> --paths <p> --decision <reason> --disposition outside_scope
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

`coordinate dispatch [--model <value>]` records the dispatch model argument
(`bouncer subagent-model --agent <name>` output, a slug or `inherit`) as
`model` on the task's `dispatch` and on the dispatch decision; omit the flag and
no `model` key is written. A valueless or blank `--model` is refused with
`model-invalid` before any attempt opens. `coordinate worker-model --blueprint
<dir> --role <implementer|reviewer|debugger> --model <value> --ledger-path <p>
--ledger-hash <h> [--task <ddd>] [--perspective <name>] [--tokens <n>]` runs from
the integration cwd and appends `{kind: worker-model, role, model, task?,
perspective?, tokens?}` to the ledger
decisions (and to that task's decisions when `--task` is given) without
changing dispatch, lease, status, or attempt. `--perspective` is reviewer-only
and must be an execute review perspective. `--tokens` is the host-reported
subagent token count (`/^\d+$/`, safe integer); without it no `tokens` key is
written and the record counts as missing. `coordinate worker-tokens --blueprint
<dir> --role <implementer|reviewer|debugger> --tokens <n> --ledger-path <p>
--ledger-hash <h> [--task <ddd>] [--perspective <name>]` appends
`{kind: worker-tokens, role, tokens, task?, perspective?}` the same way for a
completion notice that arrives after the worker-model record (a missing
`--tokens` is usage, exit 2). Refusals: `worker-model-role-invalid`,
`worker-model-perspective-invalid`, `tokens-invalid`, `model-invalid` (worker-model
only), `task-outside-blueprint`; none writes the ledger. The recorded model is
what the coordinator passed to the dispatch, not proof of the model the host ran.
`metrics summary` adds `worker_tokens: {total, missing, by_role: {implementer,
reviewer, debugger}}` from these decisions, per `(task, role, perspective)` key:
`missing` is `max(0, worker-model records − reported tokens)` summed over keys,
and it is never added to the `coordinator-session` `tokens_total`.

`coordinate dispatch` also returns a top-level `report_path`
(`<workerPath>/.bouncer/runtime/reports/<task>-<attempt>.md`, absolute) that the
implementer fills with its final report; `coordinate next` carries the same
`report_path` in the `implement` payload. Every checkpoint adds
`active_tasks[].report: { path, attempt, state }` for a task whose
`dispatch.status` is `active`: `present` when the current attempt's file is a
non-empty regular file, otherwise `absent` (missing, empty, directory, an older
attempt's file, or a stat error). It is computed at projection time and never
stored in the ledger.

At the base checkout, `current --set` that would add a new key beside an
existing one is refused with `CURRENT_WOULD_BE_AMBIGUOUS` (exit 1, pointer
unchanged, `cause` explains why the pointer would be ambiguous, `next` lists the commands); pass `--replace` to swap the uniquely
selected key or `--keep-others` to keep parallel keys deliberately.
`prepare` refuses with `unassigned-worker-worktree` (`workerPath`) when a worker
path exists on disk but is not a registered worktree, before creating anything.

Do not assemble worktree paths or edit the pointer/ledger directly. In a
drive, workers report only from their assigned worktree; the coordinator owns
pointer moves, scope revisions, result recording, fan-in, and repair.
`coordinate` stdout is one-line JSON; a success response carries `checkpoint`
(and prepare also `opened[]`) instead of ledger copies of `tasks` or
`decisions`.
When `prepare` recreates a revoked worker it first preserves uncommitted
changes (patch under integration `.bouncer/runtime/salvage/`) and unintegrated
commits (`refs/bouncer/salvage/<task>/g<gen>-<short>`), records a
`worker-salvage` decision, and lists them in the output `salvage` array
(`task`, `patch`, `ref`). A clean worker adds no `salvage` key. If preserving
fails, `worker-salvage-failed` (exit 1) leaves the worker, branch, and ledger
unchanged.
`coordinate bootstrap` sets ledger `mode: light` only when blueprint
`bouncer.scale` is `light` and the blueprint has exactly one commit task with
an empty `depends_on`; otherwise a light scale is refused with
`light-requires-single-task`. Light prepare assigns `workerPath` to the
integration worktree (no worker worktree), `coordinate next` implement carries
`payload.inline: true`, and integrate records fan-in verified without
cherry-pick. Light `report --outcome accepted` requires blueprint-root
`review.md` rounds from `bouncer review record` and document status `accepted`
(`light-review-required` otherwise). `report --outcome accepted` and `record`
refuse, before any ledger write, a worker without a confirmed task commit:
`worker-commit-missing` (HEAD is `integrationHead` or its ancestor),
`worker-commit-stamp-mismatch` (`commit_sha` absent or not HEAD's first 8
characters), `worker-scope-dirty` (a dirty path inside the current scope, even
if dirty at dispatch); the output carries `head`, `integration_head`, `stamp`,
`dirty_paths`, and `next` points at `coordinate advance`. A resume bootstrap against the opposite
mode fails with `ledger-mode-mismatch`. Ledgers without `mode` read as full.
`coordinate promote-stop` (light only) records `status: promotion_stopped` and
a `promotion` snapshot (`reason`, `summary`, open task, `diff_sha`, optional
evidence ids). Reasons are `security-risk`, `out-of-scope`, `task-split`,
`interface-semantics`, `reviewer-wider-scope`. Same reason+summary is
idempotent; afterward `prepare`/`dispatch`/`report`/`record`/`integrate` and
`run preflight` delegation fail with `promotion-stopped`. There is no resume —
full replan needs a new `bootstrap` and `current --set`.
After the main checkout has an approved full blueprint, `coordinate bootstrap --promote-light` archives a promotion-stopped light ledger and saves integration dirty changes to `.bouncer/runtime/light-promoted.patch`. It resets those changes, seeds the full plan, and creates a full ledger on the same integration branch. The response and ledger include `promoted_from`; `coordinate next` passes its patch path as `promoted_patch` in the implement payload. Rejections are `promote-light-requires-stopped`, `promote-light-scale-light`, `promote-light-archive-exists`, and `promotion-diff-drift`. A failed partial promotion reports `promote-light-incomplete` and whether rollback completed.
`coordinate advance` runs deterministic `next` argv actions (`prepare`,
`integrate`, `verification_node`, `verify`, `commit`) and stops at `judge`,
`worker`, `blocked`, `done`, `none`, `max-steps`, `yield`, or a failure
(`repeated-failure`, `unclear-result`, `advance-argv-invalid`, or the
automatic action's reason).
`run preflight` also reports `direct_eligible` (delegable, `full`, serial shape,
`1 <= commit_tasks <= coordinator.direct_max_commit_tasks`); `/bouncer-run`
offers root-direct execution only when it is true. `bouncer metrics start
--kind root-direct-session` records that session (no `--target-digest`).
`yield` is a session boundary with no argv: the coordinator returns `continue`.
The root runs `coordinate session-open --blueprint <dir> --ledger-path <p>
--ledger-hash <h>` from the integration cwd before each coordinator dispatch;
it appends a `{kind: session, opened_at, integration_head, waves_cap}` decision
and returns a fresh checkpoint (`ok: false` with `ledger-mode-mismatch` or
`ledger-not-active` otherwise). `coordinator.waves_per_session` caps the waves
per session (`docs/configuration.md`).
When a `coordinate` JSON response has `ok: false`, follow its `next` and do
not recover by reading plugin sources.
`coordinate repair` and `coordinate revise` accept only paths tracked at the
integration HEAD: an untracked `--paths` entry is refused with
`scope-path-untracked` (the output lists it in `paths`), and a `--new-path` file
to create needs a tracked parent directory or it is refused with
`scope-new-path-parent-missing`. The tracked-path check treats each value as a
literal pathspec: glob characters and pathspec magic (for example `:(...)`) are
matched as plain text, never expanded. On a `scoped_terminal` blueprint `repair`
also needs `--verify <argv>`, one command that checks only the failing files:
`repair-verify-required` when missing, `repair-verify-not-single-argv` for shell
operators or an empty value, `repair-verify-is-terminal` when it equals the
terminal command. A legacy blueprint keeps the terminal verify unless `--verify`
is given (then only the single-argv check applies). `--verify` cannot be
combined with `--resume-task`, and a valueless `--verify` or `--new-path`
exits 2. All of these refuse before the ledger or task documents change.
A `coordinate revise` refusal is written to stdout as JSON
`{ ok: false, reason, paths?, cause, next }` with exit 1 (`paths` only when the
reason lists paths, such as `scope-path-untracked`).
`coordinate next` returns `commit` when the task worktree has scope changes to
commit; on a clean tree whose commit stamp is stale it returns a `blocked`
action with reason `worker-commit-stamp-mismatch` instead.
Use `coordinate revise` only from the assigned worker worktree with a reason
and explicit source paths. A `partial-close` requires the workflow's explicit
user confirmation and is unresolved handoff, not ordinary completion.

## Read-only discovery and Graphify

```sh
bouncer project-root
bouncer intent --symbol <function-name> [--candidate <qualified-ref>] [--limit <1..5>]
bouncer intent bundle --task <tasks.md> --symbol <name>... [--candidate <qualified-ref>]...
bouncer intent bundle --task <tasks.md> --no-symbols
bouncer intent sections --task <tasks.md> --role <implementer|reviewer|debugger>
bouncer graphify-bin
bouncer graph-sync
bouncer subagent-model --agent <name> [--provider <name>]
bouncer config --help
bouncer retro sources [--repo <dir>] [--limit <1..200>] [--claude-root <dir>] [--codex-root <dir>] [--cursor-root <dir>]
bouncer retro read --path <file> [--max-chars <n>]
bouncer codex-agents check --agent <name>
bouncer review-dispatch plan --blueprint <dir> [--previous <file>]
bouncer review-dispatch execute --blueprint <dir> [--task <ddd>] --base <sha> --head <sha> [--mode discovery|delta]
  # --mode delta → strategy single / perspectives [combined] (delta certification)
  # light scale → strategy single / perspectives [combined] (diff size ignored);
  # non-empty review_risk still appends security
bouncer dispatch print --role <implementer|reviewer|debugger|context-reviewer|coordinator> \
  --cwd <dir> --input <file> --out <dir> [--repo <dir>]
```

Use `project-root` to locate the consuming repository from linked worktrees.
`retro sources` lists this project's Claude Code, Codex, and Cursor transcript
candidates newest first as JSON, with `skipped` reasons; it never reads transcript bodies.
`retro read` normalizes one transcript (Claude Code/Codex JSONL or Cursor `state.vscdb`)
into `{ role, text }` messages capped at `--max-chars` (default 200000, newest kept);
failures are `{ ok: false, reason: unreadable|unsupported-schema }` (exit 1).
Resolve Graphify through `graphify-bin`; never invoke a bare guessed binary.
Graph absence is a reported state, not permission to invent graph results.

`intent bundle` creates or reuses the task intent cache; `--no-symbols` records an empty function list for tasks without function symbols and cannot be combined with `--symbol`/`--candidate`. `intent sections` is
read-only: it projects role-specific section bodies from that cache. Successful
implementer responses also include `symbol_locations`, copied in bundle order
from resolved (including historical) and unlinked entries; unresolved and
unselected ambiguous entries have no location. Reviewer and debugger responses
retain their existing shape without this field. The projection preserves the
bundle ID, revision, brief hash, and existing `functions` data. On
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

`review-dispatch` is read-only. It returns JSON for Plan (`skip | single`;
older stored `clustered` payloads are still read) or Execute (`single | parallel`, with `security` when
`review_risk` is non-empty). Plan `single` also includes
`snapshot_version` (2), `parts` (per-document body sha256), `scope_parts`
(per-`tasks.md` scope sha256; observation only, never a `follow_up` input),
`structure_parts` (per-document structure sha256; the `follow_up` input),
`documents_content` (per-document structured content for diffs), `follow_up`
(`full` | `partial`), `changed_documents`, and for a
revision the `revision_diff` (per changed document `before`/`after`) and
`related_documents` (current contract text, not repeated from changed
documents). A delta call receives exactly `{mode, target, previous_findings,
changed_documents, revision_diff, related_documents, cwd}`. Pass
`--previous <file>` (the unmodified prior plan payload) to compare. Omitting it is
valid only for a first classification of a blueprint with no review evidence
(`follow_up: full`; `changed_documents` lists every current document with
`before: null`); once a cycle or recorded
rounds/findings exist, `previous` is required. Those fields are absent on `skip`
(light never checks `previous`) and on failures. Failures are
`{ ok: false, reason, cause, next }` (exit 1) with `previous-payload-required`
(missing), `previous-payload-invalid` (not JSON, wrong shape, another blueprint,
unreadable stored reference), or `previous-payload-stale` (differs from the
cycle `latest_dispatch`). `--previous` without a path or a repeated
`--blueprint`/`--previous` is exit 2. `bouncer context-review start|record|close|restart|route`
owns cycle state (`start|record|restart|route` take `--blueprint <dir> --dispatch <json>`;
`record` also takes `--round <json>`, `--status`, `--accept-risk`, and its success may carry `warnings` (`finding-merge-candidate`: findings of the round that share `file` and `symbol` under different categories; key omitted when none, never blocks), but it rejects with `context-review-input-invalid` a round whose merged findings share a fingerprint under different ids, at any `--status`, leaving state and report files unchanged (merge them and record the same round again);
`close` takes `--blueprint <dir> --dispositions <json>` and optional `--accept-risk`;
`restart` takes `--reason`, at most once); run `bouncer context-review --help`. The path that closes the cycle (`close` or `record --status accepted`) writes `context-review.md` and returns `written`. A stale target after the delta
is routed `reuse` (same target), `delta` (only discovery recorded, partial),
`restart` (delta used or structural, `restart_count` below 1) or `user`
(round pending, open `must_fix`, restart spent); routing never writes state.
`context-review route` is that read-only routing: it derives `follow_up` from the
`--dispatch` payload (a plan run with `--previous`) and prints
`{ ok, next_action, reason, cause, next, cycle }`; a payload without `follow_up`
is `context-review-input-invalid` (exit 1). Omit `--task` on execute to classify
the whole `base..head` diff and the union of commit-task `review_risk`
(`target.task` is then `null`). On structural or input failure it prints
`{ ok: false }` without a reviewer list (exit 1). Plan dispatch also returns
`{ ok: false }` with `plan draft validation failed` and the plan-gate
`failures` (G5, G10–G12, G19, G20) when the draft fails. Invalid argv is exit 2.
`dispatch print` runs one Cursor print process. It returns JSON for success
(`ok: true` with `report`) or `{ ok: false, reason, cause, next }` (exit 1).
`reason` is `print-dispatch-disabled`, `agent-unavailable`,
`agent-exit-nonzero`, `result-missing`, `result-error`, `report-missing`
(the final `result` is absent or blank), `dispatch-input-invalid`, or `role-document-invalid`. Follow `next`; do not
assemble the identity line, role body, or `agent --print` argv in the
session. Invalid argv (`print` missing, unknown `--role`, duplicate or
missing `--role`/`--cwd`/`--input`/`--out`) is exit 2.

```sh
bouncer review record --blueprint <dir> [--task <ddd>] --round <json-file> [--status <requested|addressed|accepted>]
```

`review record` writes one round and finding updates into `review.md`
frontmatter only after the same finding/round checks as G21 and G14 pass.
Success is `{ ok: true, path, round, status, findings }` (exit 0), plus `warnings: [{ code: 'finding-merge-candidate', file, symbol, ids }]` when findings of the round share `file` and `symbol` under different categories (key omitted when none; never blocks the record). Failure is
`{ ok: false, reason, cause, next }` (exit 1) and leaves the file unchanged.
`reason` is `review-target-missing`, `review-task-required`,
`review-task-not-allowed`, `review-input-invalid`,
`review-round-out-of-sequence`, or `review-ledger-invalid`. Follow `next`; do
not edit YAML by hand or read validator sources to invent a passing
frontmatter. Invalid argv (`record` missing, `--blueprint`/`--round` missing,
duplicate options, `--task` not three digits, `--status` outside
`requested|addressed|accepted` including `pending`) is exit 2.

```sh
bouncer review accept-risk --blueprint <dir> --finding <id> --note <text> --yes
```

`review accept-risk` closes one `open` finding of a blueprint-scope final review
as a user-accepted risk, because the final review is a single round and cannot
take another. Run it only after the user explicitly approves accepting that
risk; `--yes` carries that approval. It changes only the target finding
(`status: accepted`, `accepted_risk: true`, `note`) and leaves `rounds`
unchanged; the document status becomes `accepted` only when no finding stays
`open`. Success is `{ ok: true, path, finding, status, open_remaining }`
(exit 0). Failure is `{ ok: false, reason, cause, next }` (exit 1) with
`reason` `review-accept-risk-confirmation-required` (no `--yes`, checked before
any file read), `review-accept-risk-task-scope` (the review is not
`review_scope: blueprint`), `review-target-missing`, `review-finding-missing`,
`review-finding-not-open`, `review-note-required` (blank `--note`), or
`review-ledger-invalid`. A missing or duplicate `--blueprint`/`--finding`/
`--note`, or any `--task`, is exit 2.

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

Terminal CI failures add two mutually exclusive forms of `coordinate repair`
(both need `--task <terminal>`, the recorded `--failure-command`, `--summary`,
`--paths`, `--decision`, and the ledger path/hash fence; both without a value, or
together, exit 2). `--resume-task <ddd>` reassigns an already integrated
implementation task of the same blueprint: no task is added, IDs, DAG, and
approved scope stay unchanged, `--paths` must lie inside that task's scope, the
lease is revoked so `prepare` hands it to a worker cut from the current
integration HEAD with a new generation, and the terminal re-verifies after
reintegration (one repair wave). `--disposition outside_scope` records that the
cause, the failing test, and the needed change are outside every approved task
scope. It binds the original evidence id and source digest recorded at the
failure; the failure and the `verifying` status stay, and `next`, `validate
--gate finalize`, the finalize digest, and the PR treat it as a separate
warning, never as passed or integrated. Refused before any write: both options,
a command or task other than the recorded failure
(`failure-evidence-mismatch`), missing evidence or source identity
(`disposition-evidence-required`), a changed source (`disposition-stale-source`),
a path owned by any task scope (`disposition-scope-mixed`), a non-integrated or
foreign resume task (`resume-task-invalid`), a path outside the chosen task's
scope (`repair-scope-out-of-bounds`). Review-caused repair and supplement are
unchanged.

## Controlled migrations

```sh
bouncer migrate task-layout [--dry-run]
bouncer migrate context-slugs [--yes]
bouncer migrate merge-legacy-epics [--yes]
bouncer migrate retention
bouncer migrate retention --apply --blueprint <dir>
bouncer import [--source merges|commits] [--since <ref>] [--limit <n>] \
  [--epic-name <slug>] [--yes --message <msg>]
```

Inspect dry-run output before any write. `migrate context-slugs` prints its plan
without `--yes` and, with `--yes`, moves numbered epic and blueprint directories to
slug directories, rewrites ids and hashes, and records `legacy_id` and
`blueprint_aliases` in the v2 registry; it refuses a dirty tree or an in-progress
run. `migrate merge-legacy-epics` likewise prints its plan (moves, rewritten document
count, `movedTo`, `unresolved_rows`) without `--yes`; with `--yes` it `git mv`s each legacy
epic blueprint into its domain epic, rewrites ids, order and hashes, records `moved_to` on the
registry's legacy entries, and validates the moved blueprints. It refuses free-text exception
rows (`merge-mapping-invalid`), a dirty tree, and in-progress runs, and a second run is a no-op.
Retention's default is an audit;
`--apply` modifies one eligible closed blueprint and deletes transient files.
`import` is dry-run unless both `--yes` and `--message` are present.

## Result handling

Exit code `0` means the command completed, `1` is an operational or gate
failure, and `2` is invalid usage. Consume structured stdout where a command
returns JSON. When a `validate` failure item includes `next`, that sentence is
the recovery action — follow it instead of reading validator sources. Do not
infer success from prose, partial output, or a command that returned a
non-zero exit code.
