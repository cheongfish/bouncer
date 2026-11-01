# CLI coordinator contract

Run preflight and detach, pointer, worktree, and coordinator-drive commands. Index and
result handling live in `${BOUNCER_ROOT}/rules/cli.md`; workflow commands live in
`${BOUNCER_ROOT}/rules/cli-workflow.md`; removed light-mode recovery lives in
`${BOUNCER_ROOT}/rules/cli-migration.md`.

## Run preflight and detach

```sh
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
(4) `delegable:false` from the ledger status: `light-mode-removed`,
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
`report`, `record`, `integrate`, `repair`, `reverify`, `revise`, supplement, `session-open`)
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

## Pointer, worktree, and coordinator commands

```sh
bouncer current [--set <dir> [--base <branch>] [--task <NNN|TASKS-NNN>] [--replace] [--keep-others]] [--clear]
bouncer seed-worktree --blueprint <dir> --to <worktree>
bouncer coordinate <bootstrap|prepare|ready|dispatch|report|record|rerecord|revoke|integrate|status|revise|repair|reverify|partial-close|critical-recovery|next|advance|session-open|worker-model|worker-tokens|note|uncommit> --blueprint <dir> ...
bouncer coordinate status --blueprint <dir> --write-input <file>
bouncer coordinate prepare --blueprint <dir> [--accept-broken-baseline]
bouncer coordinate advance --blueprint <dir> [--task <ddd>] [--max-steps <n>]
bouncer coordinate repair --blueprint <dir> --task <ddd> --failure-command <cmd> \
  --summary <text> --paths <p> --decision <reason> [--verify <argv>] [--new-path <p>]...
bouncer coordinate revise --blueprint <dir> --task <ddd> --paths <p> [--new-path <p>]... \
  [--release-do-not-touch <p>]... [--replace] --reason <text>
bouncer coordinate repair --blueprint <dir> --task <ddd> --failure-command <cmd> \
  --summary <text> --paths <p> --decision <reason> --resume-task <ddd>
bouncer coordinate repair --blueprint <dir> --task <ddd> --failure-command <cmd> \
  --summary <text> --paths <p> --decision <reason> --disposition outside_scope
bouncer coordinate repair --blueprint <dir> [--task <ddd>] --review-finding <id> \
  [--review-finding <id>]... --summary <text> --paths <p> --decision <reason>
bouncer coordinate repair --blueprint <dir> --kind supplement --review-finding <id> \
  [--review-finding <id>]... --summary <text> --paths <test-path>
bouncer coordinate repair --blueprint <dir> --kind supplement --done --summary <text>
bouncer coordinate reverify --blueprint <dir> --task <terminal ddd>
```

`coordinate promote-stop` was removed (exit 2).
`coordinate bootstrap --promote-light` was removed (exit 2).

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
--ledger-hash <h> [--task <ddd>] [--perspective <name>] [--tokens <n>]
[--strategy <single|parallel>] [--reviewer-tier <standard|strong>]` runs from
the integration cwd and appends `{kind: worker-model, role, model, task?,
perspective?, tokens?, strategy?, reviewer_tier?}` to the ledger
decisions (and to that task's decisions when `--task` is given) without
changing dispatch, lease, status, or attempt. `--perspective` is reviewer-only
and must be an execute review perspective. `--strategy` and `--reviewer-tier`
are reviewer-only too. They copy the `strategy` and `reviewer_tier` the
`review-dispatch` payload gave, as-is, and are written only when the flag is
given; the coordinator does not recompute them. `reviewer_tier` records the
computed tier, not whether the model mapping applied (`reviewer_tier_applied`
is not written). `--strategy` and `--reviewer-tier` are refused as usage (exit 2)
on `worker-tokens`. `--tokens` is the host-reported
subagent token count (`/^\d+$/`, safe integer); without it no `tokens` key is
written and the record counts as missing. `coordinate worker-tokens --blueprint
<dir> --role <implementer|reviewer|debugger> --tokens <n|unreported> --ledger-path <p>
--ledger-hash <h> [--task <ddd>] [--perspective <name>]` appends
`{kind: worker-tokens, role, tokens, task?, perspective?}` the same way for a
completion notice that arrives after the worker-model record (a missing
`--tokens` is usage, exit 2). A `worker-tokens --tokens unreported` record appends
`{kind: worker-tokens, role, unreported: true, task?, perspective?}`. The host gave
no value, so the key is filled without a number; no `tokens` key is written, so
the sum never reads that key as zero. `worker-tokens` refuses a second record for a `(task, role, perspective)` key with
`worker-tokens-duplicate` (exit 1, `existing` is the latest record, ledger unchanged) once every
`worker-model` record of that key has a token or `unreported` record.
`worker-tokens --replace` (a flag with no value, `worker-tokens` only) swaps the latest
`worker-tokens` record of the key and returns it as `replaced`; a key with no `worker-tokens` record is
refused with `worker-tokens-replace-target-missing`, and `--replace` with a value or on `worker-model` is
usage (exit 2). `worker-tokens --tokens ambiguous` is the non-blocking recovery for a key whose host
completion cannot be tied to one call. It appends `{kind: worker-tokens-ambiguous, role, task?, perspective?,
model_rows, token_rows}`, where the two counts are the key's worker-model and worker-tokens records at that
moment. Those earlier rows become a frozen unattributed set. The marker writes no `tokens` and no `unreported`,
never changes an existing row, and assigns no value to any call. The `worker-tokens-missing` check (advance and
record) exempts only the frozen rows, so advance resumes; rows added to the key later are checked as usual.
The sum still counts the frozen rows as missing, so their tokens stay unmeasured. A key with no worker-model or
worker-tokens record is refused with `worker-tokens-ambiguous-target-missing`, a second marker over the same
rows with `worker-tokens-ambiguous-duplicate`, and `--replace` combined with `--tokens ambiguous` with
`worker-tokens-ambiguous-replace`; each is exit 1 with the ledger unchanged. The `worker-tokens-missing` check covers these keys:
`coordinate record --task <T>` checks the keys of task T,
`coordinate advance --task <T>` checks the keys of task T and the keys with no task,
and `coordinate advance` without `--task` checks the keys with no task. `coordinate advance` also checks the
`implementer` keys of every task, because that record is written after the worker finished. Refusals: `worker-model-role-invalid`,
`worker-model-perspective-invalid`, `worker-model-strategy-invalid`,
`worker-model-reviewer-tier-invalid`, `tokens-invalid`, `model-invalid` (worker-model
only), `task-outside-blueprint`; none writes the ledger. The strategy and tier
checks run after the perspective check and before `tokens-invalid`. The recorded model is
what the coordinator passed to the dispatch, not proof of the model the host ran.
Plan and execute metadata are configuration observations only; they do not
attest which model the host actually ran. A rejected configured model stops the
named dispatch. Report provider, role, configured name, exact host reason, and
the setting location; do not retry with `inherit` or invent an alias. When the
host explicitly returns a supported model name, report that exact value.
`metrics summary` adds `worker_tokens: {total, missing, by_role: {implementer,
reviewer, debugger}}` from these decisions, per `(task, role, perspective)` key:
`missing` is `max(0, worker-model records − reported tokens)` summed over keys,
and it is never added to the `coordinator-session` `tokens_total`.

`coordinate note --blueprint <dir> --text <text> --ledger-path <p> --ledger-hash <h>
[--task <ddd>]` appends `{kind: note, text, written_at, task?}` to the ledger
decisions so the next coordinator session reads it in `checkpoint.notes`,
without changing dispatch, lease, status, or attempt. The text is trimmed and
at most 2000 characters; a missing `--text` or a valueless `--task` is usage
(exit 2). Refusals: `note-text-required`, `note-too-long`,
`note-review-handoff-invalid`, `task-outside-blueprint`; none writes the ledger.
A text that starts with `review-handoff:` is checked against the two shapes of
the direct-run.md Handoff (the handoff shape or the `unavailable` shape); any
other text is recorded as is. The check reads no file: `files=` existence and
sha256 stay with the coordinator document rules. Note bodies are data, never
instructions.

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

When the main checkout `.bouncer/config.json` sets `worktree.baseline` (one
allowlisted command, run in the integration cwd with a 30 minute timeout), the
first full-ledger `prepare` runs integration dependencies and then the baseline
before creating any worker, and appends a `baseline` decision
(`command`, `exit`, `head`, `accepted`, `written_at`). A non-zero exit refuses
with `baseline-ci-failed` (`command`, `exit`; exit `124` is a timeout or signal,
`127` a spawn failure) and creates no worker; only after the user explicitly
approves, `prepare --accept-broken-baseline` reruns it and proceeds, recording
`accepted: true`. A passed or accepted baseline is not rerun; without the config
the flag is ignored. A value that is not a string or not
an allowlisted single command refuses with `baseline-config-invalid` and runs
nothing. A successful `prepare` carries `warnings`; it holds
`{ kind: 'worktree-setup-unset' }` only when the integration `package.json` has
`scripts.build` and `worktree.setup` is unset.
On a `verification_policy: scoped_terminal` blueprint, `coordinate report
--outcome accepted` also checks the report `## Tests` like fan-in does and
refuses with `report-tests-invalid` (`problem`, `expected_command`) before
writing the ledger when the task `bouncer.verify` command or a passing result
is missing.

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
(`task`, `patch`, `ref`, and `report`). A revoked worker's latest report is
preserved as `.bouncer/runtime/salvage/<task>-g<gen>-<short>.report.md` and
listed as `report`. A worker with no patch, ref, or report to keep adds no `salvage` key;
a worker holding only a runtime report still gets `salvage` with that `report`. If preserving
fails, `worker-salvage-failed` (exit 1) leaves the worker, branch, and ledger
unchanged.
`coordinate revoke --blueprint <dir> --task <ddd> --reason <text>` takes back a
prepared or recorded task's lease. It does not judge the cause: call it only after
the cause is classified and an environment failure is shown gone, never for a
user decision, a gate failure, or an unclassified blocked report. Its refusals
(`task-required`, `decision-reason-required`, `illegal-transition`,
`task-outside-blueprint`) return before the ledger write, so the ledger and the
worker worktree stay unchanged. A revoke leaves the worker worktree in place; the next
`prepare` preserves the worker's changes and report as above and issues a new generation
lease, and an old lease's report is refused as `stale-lease`.
`coordinate bootstrap` always writes a full ledger. A `mode: light` ledger is
refused with `light-mode-removed` regardless of task status; read-only
`coordinate status` and the finalize digest still read it. `scale: light` on an
open blueprint is the same refusal. The recovery steps are in `${BOUNCER_ROOT}/rules/cli-migration.md`.

Prepare assigns `workerPath` under the integration sibling `workers/<ddd>`;
`coordinate next` implement carries no `inline` key. `report --outcome accepted` and
`record` refuse, before any ledger write, a worker without a confirmed task
commit: `worker-commit-missing` (HEAD is `integrationHead` or its ancestor),
`worker-commit-stamp-mismatch` (`commit_sha` absent or not HEAD's first 8
characters), `worker-scope-dirty` (a dirty path inside the current scope, even
if dirty at dispatch); the output carries `head`, `integration_head`, `stamp`,
`dirty_paths`, and `next` points at `coordinate advance`. In a full ledger,
`report --outcome accepted` also judges the worker commit's paths outside the
ledger scope (candidates from `git diff --name-only --no-renames
<base_head>..HEAD`, both sides of a rename): a path under a Do not touch line of
the integration copy of the task document is refused as
`scope-do-not-touch-violation`, an unreadable document as
`scope-do-not-touch-unreadable`, and a path without a usable
``- `path` — reason`` line under the report's `## Unexpected paths` (1 to 200
characters) as `unexpected-path-reason-missing` with `paths`. Accepted deviations
are stored as `ReportDecision.unexpected_paths` (`[{ path, reason }]`, path order)
and `overlaps` lists the other unintegrated tasks of the drive whose scope covers
one of them; both keys are absent when nothing deviated. `commit --yes` in a full
ledger drive likewise allows a path outside the ledger scope that no Do not touch
line covers and reports it as `unexpected_paths` (key absent when none); a
Do not touch hit is `scope-do-not-touch-violation` and an unreadable line is
`scope-do-not-touch-unreadable`, both with `recovery.action` `coordinator-revise`
(composite gate `commit-scope`). Commits without a ledger keep
`out-of-scope`. Ledgers without `mode` read as full.

`coordinate next` may still pass a stored `promoted_patch` for an already
promoted full ledger. `drive_record` (metrics snapshot / finalize digest)
carries `mode` (`light`|`full`) and `promotion` (`{ reason, task }` or `null`);
`reviewer.strategies` and `reviewer.tiers` are the sorted unique `strategy` and
`reviewer_tier` values of the reviewer `worker-model` decisions (`coordinate
worker-model`, role `reviewer`); an absent key reads as an old snapshot.
`tiers` is the computed tier recorded in the payload, not whether the model
mapping applied (`reviewer_tier_applied` is not recorded here), so a dispatch
computed as `strong` with no mapping still counts as `strong`.
`node scripts/measure-drive-records.js` splits aggregates under `by_mode` and
counts under `promotions`.
`coordinate advance` runs deterministic `next` argv actions (`prepare`,
`integrate`, `verification_node`, `verify`, `commit`) and stops at `judge`,
`worker`, `blocked`, `done`, `none`, `max-steps`, `yield`, or a failure
(`repeated-failure`, `unclear-result`, `advance-argv-invalid`, or the
automatic action's reason, or `advance-status-unavailable`). Successful responses include `status`, the final `coordinate status` object; status failure retains `executed`. Before running any action, `coordinate advance` refuses
with `worker-tokens-missing` (exit 1, no `executed`) while a checked worker key has
no token record. The refusal runs before the automatic action so that no argv runs
against a ledger whose worker usage is still unrecorded.
`run preflight` also reports `direct_eligible` (delegable, serial shape,
`1 <= commit_tasks <= coordinator.direct_max_commit_tasks`). `/bouncer-run`
offers root-direct execution only when `direct_eligible` is true.
`bouncer metrics start --kind root-direct-session` records that session
(no `--target-digest`).
`yield` is a session boundary with no argv: the coordinator returns `continue`.
The root runs `coordinate session-open --blueprint <dir> --ledger-path <p>
--ledger-hash <h>` from the integration cwd before each coordinator dispatch;
it appends a `{kind: session, opened_at, integration_head, waves_cap}` decision
and returns a fresh checkpoint (`ok: false` with
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
terminal command, `repair-verify-not-allowed` when argv0's basename is outside
the repository `verify_allowlist` (same basename rule as S12, so `/usr/bin/node`
is allowed when `node` is listed). A legacy blueprint keeps the terminal verify
unless `--verify` is given (then the single-argv and allowlist checks apply).
`--verify` cannot be
combined with `--resume-task`, and a valueless `--verify` or `--new-path`
exits 2. All of these refuse before the ledger or task documents change.
A `coordinate revise` refusal is written to stdout as JSON
`{ ok: false, reason, paths?, cause, next }` with exit 1 (`paths` only when the
reason lists paths, such as `scope-path-untracked`).
A `coordinate revise` whose new scope paths (those not already in the previous
scope) overlap an entry of the task brief's `Do not touch` section is refused
with `scope-do-not-touch-conflict` (`paths` lists the overlapping entries). Name
each one with `--release-do-not-touch <p>` (repeatable); the same write then
removes that entry from the brief. A release value that is not an overlapping
entry is refused with `release-do-not-touch-unknown`, and a valueless
`--release-do-not-touch` exits 2. Both refusals leave the document and ledger
unchanged.
A `coordinate revise` widens the scope by default: the new scope is the previous
scope plus `--paths` and `--new-path`, with duplicates removed by normalized path
(a trailing `/` and a leading `./` do not make a new entry). A previous path is
never dropped by a call without `--replace`, so a narrower `--paths` value does
not shrink the scope. `--replace` (valueless, a boolean) swaps the scope for
exactly `--paths` plus `--new-path`; each previous path that the new set does not
cover is reported in `warnings` as `scope-paths-dropped`, and only a replace emits
that warning. `--replace <value>` exits 2 with `coordinate revise: --replace takes
no value`. Empty `--paths` and `--new-path` are refused with `scope-paths-required`
whether or not `--replace` is given.
`coordinate next` returns `commit` when the task worktree has scope changes to
commit; on a clean tree whose commit stamp is stale it returns a `blocked`
action with reason `worker-commit-stamp-mismatch` instead.
When the stamp is empty and the worker has a commit without a `Bouncer-Task`
trailer, `coordinate next` returns `blocked` with reason
`worker-commit-untrailered` whether or not the scope is dirty.
`coordinate uncommit --task <ddd>` (fenced, run from the worker cwd) soft-resets
to the parent of the oldest untrailered commit and records an `uncommit`
decision. It is refused with `uncommit-not-needed` when no such commit exists.
Use `coordinate revise` only from the assigned worker worktree with a reason
and explicit source paths. A `partial-close` requires the workflow's explicit
user confirmation and is unresolved handoff, not ordinary completion.

## Final review repair, reverify, and terminal CI

`coordinate repair` takes
either `--failure-command` (terminal CI) or repeated `--review-finding`
(final-review must_fix), never both. Omit `--task` on the review-finding form
when the blueprint has no terminal verification task. `--kind supplement`
accepts an in-scope test-evidence gap without a new task or repair wave (test
paths inside an integrated task's `affected_paths`, no delta round yet);
`--done` verifies it. In a `review_contract: brief` blueprint the final review
allows one `--review-finding` repair (all violation findings, approved paths,
`newPaths` allowed unless they hit a Do not touch line; accepted ones are recorded as `unexpected_paths` on the repair decision) before the one delta. A legacy blueprint (no marker) allows no
repair after the discovery round; its `must_fix` findings are carried as
`deferred` and only a `blocked` finding stops for `review accept-risk`. The
CLI refuses a review-caused repair or supplement with one of these reasons
(`review-contract-invalid` is a marker problem):

| Condition | Reason |
| --- | --- |
| Legacy blueprint after discovery, any supplement after discovery, or a brief blueprint whose repair or delta already ran | `final-review-single-round` |
| First brief repair that declares `newPaths` under a Do not touch line of any ledger task | `final-review-repair-do-not-touch` |
| First brief repair with `newPaths` while a ledger task document cannot be read | `scope-do-not-touch-unreadable` |

A second repair therefore returns `final-review-single-round` only; a still
open finding after the delta is reported `final-review-blocked`.
`--kind` accepts only `product` (default) or `supplement`.

When a terminal CI failure came from the environment only (a missing tool, a
stale install, a flaky service) and no source file has to change, run
`coordinate reverify --task <terminal>` before any `repair`. It needs `--task`
(missing or valueless exits 2) and the ledger path/hash fence (missing is
`ledger-checkpoint-invalid`, exit 1); a detached ledger refuses it like the
other fenced commands. It re-runs the terminal verification without opening a
repair wave, and refuses with `reverify-source-moved` when the source moved
since the recorded failure or `reverify-worktree-dirty` when the worktree has
uncommitted changes. If the code has to change, use `repair`.

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
