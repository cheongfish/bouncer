# CLI workflow contract

Stage contract for plan authoring, validation, verify, commit, finalize, and the
metrics and plan-ledger side records. Index and result handling live in
`${BOUNCER_ROOT}/rules/cli.md`; run and coordinator commands live in
`${BOUNCER_ROOT}/rules/cli-coordinate.md`.

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
bouncer finalize comprehension --blueprint <dir> --digest <json-file> (--confirm-quiz | --refresh) [--repo <dir>]
bouncer finalize pr-body --digest <json-file> --summary <markdown-file> [--flow <mermaid-file>]
```

`finalize comprehension` records the single `explain.md` comprehension entry after
a real user quiz answer. It validates `digest.blueprint` and `range.base/head`
against the current HEAD and `computeDiffSha`. Refusals (exit 1, bytes unchanged):
`comprehension-consent-required`, `comprehension-input-invalid`,
`comprehension-target-stale`; flag errors exit 2. `--refresh` needs an existing
valid entry and keeps `range_from`; it is mutually exclusive with `--confirm-quiz`.

`finalize pr-body` prints a draft PR body (Markdown) to stdout from a saved v2 digest and a
Korean summary file with `## 배경 · 변경 의도` and `## 주요 변경 내용` sections. After 주요 변경
it always emits `변경 그림`, `변경 전후`, then later `되돌리기 · 영향 범위` before 확인 방법.
`--flow` fills `변경 그림` with a Mermaid fence; without it that heading still appears with
`<TODO: 작성 필요>`, as do `변경 전후` and `되돌리기 · 영향 범위`. It is read-only: no file writes,
Git lookups, ledger reads, or PR publishing, and the same inputs give byte-identical output.
Unreadable files, invalid JSON, an invalid digest shape, or a missing summary section exit 1 with
stderr only; a missing `--digest`, `--summary`, or a valueless `--flow` exits 2.

`plan inspect` prints next ids, verify signals, and pointer state as JSON.
With `--blueprint <dir>` it also prints `coupledPaths` as
`{advisory: true, pairs, candidates}` (`null` without `--blueprint`). `pairs`
are generated pairs (`codex-agent-toml`, `gitignore-exception`), each with
`covered`. `candidates` are `path-literal` matches: a file under `test` or
`tests` whose line names a task path at a path boundary, so a match inside
another path or an identifier does not count. Each `evidence.text` is cut to
200 UTF-16 units without splitting a surrogate pair. The result is advisory and
never decides scope.
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
A blueprint that declares `bouncer.prerequisites` must have every merge result
commit in the current checkout's HEAD history. `plan approve` refuses with
`plan-approve-prerequisite` (exit 1, no file changed; `cause` lists `S39` lines
for a malformed declaration, or `G32` lines naming each prerequisite path and
reason for merge state), and the plan draft check and plan
gate report the same `G32` (composite gate `freshness-approval`). Recover by
fixing the missing reference or the merge result SHA, or by merging/rebasing
the prerequisite into this checkout, then rerun. A Git lookup error is a
failure, never a pass. Blueprints without the key are unaffected.
With `--blueprint <dir>` it also fills advisory `routing`. `modules` and
`riskPaths` come from the shared complexity signal (generated paths are left out
of modules). The `low-candidate`/`standard-candidate` recommendation is
`standard-candidate` only when the module count reaches `complexity.strong_min_modules`
or a risk path exists; task count and `depends_on` are not grounds. `serial`
(from the drive shape) is reference only. A malformed `complexity` block adds
`complexity-config-invalid` to `reasons` and keeps the default policy without
changing the recommendation. Without that flag `routing` is `null`. The signal
does not select or approve complexity.
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
main plan copies after a closed drive. A valid `outside_scope` terminal counts as closed
(the payload carries `outside_scope`); `drive-not-closed` refusals carry `cause`, `next`, and `tasks`.
Before the first cleanup mutation (and before a partial merge) it saves the ledger's worker
token totals with `metrics snapshot`; a failed save refuses with `metrics-snapshot-write-failed`
or `metrics-snapshot-invalid` and leaves main, the ledger, and the worktrees untouched. A rerun
without a ledger keeps the stored snapshot and writes nothing.

`metrics snapshot --blueprint <dir> [--repo <dir>]` reads the real ledger and writes
`{version: 1, blueprint, recorded_at, ledger_sha256, worker_tokens}` atomically to
`<git-common-dir>/bouncer/metrics-snapshots/<sha256(blueprint path)>.json` (the path must stay
inside the common dir and not be a symlink). It prints `{ok: true, blueprint, path, ledger_sha256,
reused}`: the same ledger hash is reused, a new hash refreshes the file, and without a ledger the
stored snapshot is kept (`reused: true`). No ledger and no snapshot is `metrics-ledger-unavailable`
and writes nothing. A bad flag is exit 2; a store or input failure is exit 1
(`metrics-snapshot-invalid`, `metrics-snapshot-write-failed`). `metrics summary` adds
`worker_tokens_source`: `ledger` when the ledger exists (a stale snapshot never replaces it),
else `snapshot` when a valid snapshot exists, else `unavailable` (numbers stay 0). A broken
snapshot is refused with `metrics-snapshot-invalid`, not read as 0.

`metrics start --kind` also takes `plan-coordinator-session` and `planner-session` (the plan kinds).
Only they may omit `--blueprint`: the session is stored with `blueprint: null`, reads no ledger
snapshot, and `--blueprint <dir>` at start is normalized and stored without ledger resolution.
A `--blueprint` value that normalizes to an empty string (`/`, `\`, `//`) is refused at start as
`invalid-metrics-input` (exit 1) before any write, so the file bytes stay unchanged.
`metrics end --id <m-id> [--tier <strong|standard|light>] [--effort <low|medium|high>]
[--blueprint <dir>]` stores `tier` and `effort` on any kind (omitted = `null`, case-sensitive,
empty string refused). `end --blueprint <dir>` binds a `blueprint: null` plan session exactly once
with the same normalization as `start` (no path or ledger check). It is refused on a non-plan
kind, on a session that already has a blueprint, as `""`, and a null-blueprint plan session cannot
end without it. Every such refusal is `invalid-metrics-input` (exit 1) and leaves the file bytes
unchanged. `metrics summary` adds `by_tier: {strong, standard, light, unknown}` to each kind, each
`{sessions, tokens_total, cost_total}` over ended sessions only; a missing or `null` tier is
`unknown`. A `null` blueprint is valid only on a plan kind; elsewhere it is `metrics-file-invalid`.

`bouncer plan-ledger open|status|record|ask|answer|close` keeps the plan coordinator session state
(request, phase, user questions and answers, planner session and revision counts) in the main
worktree at `.bouncer/runtime/plan-ledgers/pl-<16hex>.json`; every subcommand takes `[--repo <dir>]`
and an unresolvable main worktree is `non-git-root`. `open --request <text>` creates the file
exclusively (`plan-ledger-exists` if the id is taken) and prints `{ ok, id, checkpoint }`;
`status --id <id>` reads without a lock and prints `ledger`, `open_questions` (qids without an
answer), and `checkpoint { path, sha256, revision }`. Every mutation takes `--id`, `--ledger-path`
(the checkpoint path, exactly `.bouncer/runtime/plan-ledgers/<id>.json`) and `--ledger-hash` (the
checkpoint sha256), runs under the ledger lock, adds 1 to `revision`, and prints the new checkpoint.
`record` needs at least one of `--phase` (`discovery|checkpoint|authoring|review|ready`, forward
or same only), `--blueprint` (stored once, normalized to `/` without a trailing slash, must sit
under `.bouncer/context/epics/`), `--planner-session` with `--planner-mode`
(`initial|resume|continued|fresh`; `continued` is allowed once and total revisions are capped at 2),
and `--note`. `ask --question` prints the new `qid`; `answer --question-id --text` fills it once;
`close` makes later mutations fail. The CLI does not tell callers apart, so only the root runs
`open`, `answer`, and `close` by rule. Refusals are `{ ok: false, reason }` (exit 1) before any
write: `plan-ledger-id-invalid`, `plan-ledger-not-found`, `plan-ledger-invalid`,
`plan-ledger-exists`, `ledger-checkpoint-invalid`, `stale-ledger-checkpoint`, `ledger-locked`,
`ledger-lock-lost`, `plan-ledger-closed`, `plan-ledger-phase-backward`,
`plan-ledger-blueprint-bound`, `plan-ledger-revision-limit`, `plan-ledger-question-unknown`,
`plan-ledger-question-answered`, `invalid-plan-ledger-input`. An unknown subcommand or flag is
usage with exit 2. The run coordinator ledger and its reasons are unchanged.

## Context and task creation

```sh
bouncer scaffold epic --name <slug> --description <text>
bouncer scaffold blueprint --epic-dir <dir> --order <n> --name <slug> [--complexity low|standard] \
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
`scaffold blueprint --scale light` was removed; declare `--complexity low` instead (exit 2).

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

## Review record and accept-risk

```sh
bouncer review record --blueprint <dir> [--task <ddd>] --round <json-file> [--status <requested|addressed|accepted>]
```

`review record` writes one round and finding updates into `review.md`
frontmatter only after the shared finding/round checkers pass.
Success is `{ ok: true, path, round, status, findings }` (exit 0), plus `warnings: [{ code: 'finding-merge-candidate', file, symbol, ids }]` when findings of the round share `file` and `symbol` under different categories (key omitted when none; never blocks the record). Failure is
`{ ok: false, reason, cause, next }` (exit 1) and leaves the file unchanged.
`reason` is `review-target-missing`, `review-task-required`,
`review-task-not-allowed`, `review-input-invalid`,
`review-round-out-of-sequence`, or `review-ledger-invalid`. In a `review_contract: brief` blueprint final review, `review-input-invalid` also covers a finding whose `first_seen_round` differs from the stored value (cause `finding <id> first_seen_round changed: <stored> -> <incoming>`), so a discovery finding cannot be restated as a later delta finding. Follow `next`; do
not edit YAML by hand or read validator sources to invent a passing
frontmatter. Invalid argv (`record` missing, `--blueprint`/`--round` missing,
duplicate options, `--task` not three digits, `--status` outside
`requested|addressed|accepted` including `pending`) is exit 2.

```sh
bouncer review accept-risk --blueprint <dir> --finding <id> --note <text> --yes
```

`review accept-risk` closes one `open` finding of a blueprint-scope final review
as a user-accepted risk, because a legacy final review is a single round and a
marked (`review_contract: brief`) one allows only one repair and one delta. Run it only after the user explicitly approves accepting that
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
`--note`, or any `--task`, is exit 2. In a brief blueprint, a remaining `minor` or `nit` `must_fix` is recorded as `deferred` with a `note` when the delta round is first recorded with `--status accepted`; once the delta round is stored, any remaining finding is closed with `review accept-risk` after user approval or stops with `final-review-blocked`.

