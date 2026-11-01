# CLI discovery contract

Read-only discovery, Graphify, model resolution, review dispatch, and print dispatch.
Index and result handling live in `${BOUNCER_ROOT}/rules/cli.md`.

## Read-only discovery, Graphify, and review dispatch

```sh
bouncer project-root
bouncer intent --symbol <function-name> [--candidate <qualified-ref>] [--limit <1..5>]
bouncer intent bundle --task <tasks.md> --symbol <name>... [--candidate <qualified-ref>]...
bouncer intent bundle --task <tasks.md> --no-symbols
bouncer intent sections --task <tasks.md> --role <implementer|reviewer|debugger>
bouncer graphify-bin
bouncer graph-sync
bouncer subagent-model --agent <name> [--provider <name>] [--json]
bouncer config --help
bouncer retro sources [--repo <dir>] [--limit <1..200>] [--claude-root <dir>] [--codex-root <dir>] [--cursor-root <dir>]
bouncer retro read --path <file> [--max-chars <n>]
bouncer codex-agents check --agent <name>
bouncer review-dispatch plan --blueprint <dir> [--previous <file>]
bouncer review-dispatch execute --blueprint <dir> [--task <ddd>] --base <sha> --head <sha> [--mode discovery|delta]
  # --mode delta → strategy single / perspectives [combined] (delta certification, any blueprint;
  # discovery perspectives and security are never listed for a delta)
  # review_contract: brief, complexity standard, no --task (final review): strategy parallel, perspectives
  # spec_scope, correctness_tests; security only when review_risk has authentication|authorization|credential
  # complexity low: single [combined] regardless of size; standard (unmarked or --task): single [combined] only when
  # source files <= 2, source lines <= 200 and no review_risk or risk path (complexity-signals); else parallel
  # spec_scope, correctness_tests, minimality_maintainability; any non-empty review_risk or a security-kind risk path appends security
  # a non-default complexity policy adds "complexity policy non-default: ..." after the tier reason
  # rejected before any git call: invalid review.min_reviewer_tier (review-min-reviewer-tier-invalid), then invalid
  # complexity config (complexity-config-invalid, next: complexity)
  # --mode delta is allowed for the one delta after the single repair of a brief final review
bouncer dispatch print --role <implementer|reviewer|debugger|context-reviewer|coordinator|planner|plan-coordinator> \
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

`intent bundle` creates or reuses the task intent cache; `--no-symbols` records an empty function list for tasks without function symbols and cannot be combined with `--symbol`/`--candidate`. The result is `reused` only when a valid previous cache has the same brief hash, function set, each resolved entry's `function_ref` and blob hash, and section hashes (`bundle_id` and `revision` unchanged); otherwise it is `created` with `revision` = previous valid `revision` + 1, or 1 when the previous cache is missing or invalid. A brief-only change or a switch to `--no-symbols` is a miss, and an empty bundle with a different brief hash also increments. The first call is not a reselection; an `ambiguous` result allows one evidence-based reselection, after which `--no-symbols` is used (see `skills/bouncer-run/references/agent-dispatch.md`). `coordinate note` (C1) already covers note use, checkpoint `notes`, and the fence above; no separate note feature is added. `intent sections` is
read-only: it projects role-specific section bodies from that cache. For reviewer, repeat `--task` to get ordered `tasks: [{ task, sections }]`; duplicates and individual failures appear in `failures` with `intent-sections-partial` (exit 1). Multiple tasks for other roles return `intent-task-invalid` (exit 1). Single-task responses are unchanged. Successful
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

`subagent-model` prints one model slug, or `inherit`, as a single line without
flags; with `--json` it prints one line `{ provider, role, tier, model, effort,
source }`; on a resolution error (for example `tier-unmapped` or
`role-config-invalid`) it exits 1. Pass only the model into named dispatch;
omit the model argument when it is `inherit`. The value is configuration metadata,
not evidence of the model the host ran. The selected provider (`--provider`, else
`subagents.provider`) must be `claude`, `cursor`, `codex`, or `antigravity`; any
other value exits 1 with `role-config-invalid` on one stderr line naming the key to fix
(`--provider` or `subagents.provider`) without echoing the raw value, and a valid
`--provider` overrides an invalid configured one. A model rejection stops dispatch and
must be reported with provider, role, configured name, exact host reason, and
config correction location. `subagent-model --agent <name> --tier <tier>`
resolves the model for that call-level tier (for example `--tier strong`)
instead of the role's own tier; the usage line above stays unchanged. A reviewer
call uses it to keep the tier of its `review-dispatch` payload
(`reviewer_tier`). `codex-agents check` is read-only: it
prints `{ ok, agent, in_sync, path }` and, on drift, `reason` plus
`next: "bouncer init --seed-codex-agents"` (exit 1). The expected TOML carries
no `model_reasoning_effort`; role effort is passed at dispatch instead, so an
effort change alone does not make the TOML mismatch.
When any named agent's `roles.<agent>.effort` is not `low`, `medium`, or `high`,
check prints `reason: "role-config-invalid"` with the config `key`, `message`,
and a `next` that asks the user before fixing that key (exit 1); init with Codex
seeding rejects the same config before writing any file. Compact a named
implementer payload only when `in_sync` is true. Invalid `--agent` or a verb
other than `check` is exit 2.

Plan and execute `review-dispatch` payloads include `agent_dispatch: {agent,
provider, model}` as a snapshot of current configured dispatch values. It is
metadata, not proof of the host model. Plan review uses it to select
`bouncer-context-reviewer`; resolve again immediately before dispatch if the
current config no longer matches the payload.

Plan (`single`, `perspectives`) and Execute (`discovery`, `delta`) reviewer
`review-dispatch` payloads carry `reviewer_tier` and `reviewer_tier_applied`.
Re-resolution before dispatch follows `${BOUNCER_ROOT}/rules/subagent-model.md` item 1.

`review-dispatch` is read-only. It returns JSON for Plan (`single`, or
`perspectives` for a `review_contract: brief` blueprint; older stored `clustered`
payloads are still read) or Execute (`single | parallel`; `security` joins a
general or task-scoped review when `review_risk` is non-empty or a security-kind risk path is touched, and a brief
final review only for authentication, authorization, or credential risk). Plan
of an unmarked blueprint is `single`. A marked (`review_contract: brief`)
blueprint is `perspectives`: standard gets the four plan perspectives; low is
`verifiability` and, when any commit task declares `review_risk`, also
`risk_security`. There is no Plan `skip`. The reviewer tier is `strong` when the
union of commit tasks' `affected_paths` (plan) or the scoped `review_risk` /
risk paths hit a strong cause (source files, modules, total files); `complexity:
low` skips only the size causes and keeps the risk causes. Execute for
`complexity: low` is `single` combined regardless of size; standard is `single`
only when the frozen snapshot passes the source-file, source-line, and risk
checks, else `parallel`. Plan `single` also includes
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
rounds/findings exist, `previous` is required. Those fields are absent on
failures. Failures are
`{ ok: false, reason, cause, next }` (exit 1) with `previous-payload-required`
(missing), `previous-payload-invalid` (not JSON, wrong shape, another blueprint,
unreadable stored reference), or `previous-payload-stale` (differs from the
cycle `latest_dispatch`). `--previous` without a path or a repeated
`--blueprint`/`--previous` is exit 2. `bouncer context-review start|record|close|restart|route`
owns cycle state (`start|record|restart|route` take `--blueprint <dir> --dispatch <json>`;
`record` also takes `--round <json>`, `--status`, `--accept-risk`, and its success may carry `warnings` (`finding-merge-candidate`: findings of the round that share `file` and `symbol` under different categories; key omitted when none, never blocks), but it rejects with `context-review-input-invalid` a round whose merged findings share a fingerprint under different ids, at any `--status`, leaving state and report files unchanged (merge them and record the same round again);
`close` takes `--blueprint <dir> --dispositions <json>` and optional `--accept-risk` and
`--contract-links <json-file>`. Links are an array of `{ finding_id, path, sections }` for changed
blueprint task documents; sections are `Interface` or `Touch`. Every changed task must link to an
accepted `must_fix` finding for that same path and an explicitly approved `--accept-risk` ID.
The entire task scope digest is accepted without rereview, with before/after digests and
`accepted_without_rereview: true` recorded in closure and document. Invalid links are
`context-review-input-invalid`; changed structure, missing links or mismatched consent are
`context-review-state-conflict`; advisory IDs in `--accept-risk` are `context-review-unresolved-findings`;

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
`failures` (G5, G19, G20, G32 for a declared prerequisite, and G33) when the draft fails. G33 fires for a commit task when the checkout has `test/tiers.json`, the task declares a new `test/<name>.test.js` (a Touch `Create`/`Rename` row, or an `affected_paths` entry the Touch does not `Modify`) that does not exist, and `affected_paths` lacks `test/tiers.json`. G20 also
statically rejects, for every task (any `verification_policy`) in the plan draft check and plan gate, a `bouncer.verify` of the form `node scripts/check-doc-shape.js <doc>...` that names a
document with neither a kind nor a path contract (the checker would exit 1); it reads only the argument strings,
and a verify with no document argument (default scan) passes. Invalid argv is exit 2.
`dispatch print` runs one Cursor print process. It returns JSON for success
(`ok: true` with `report`; its `effort` field is the configured role effort,
which Cursor does not apply) or `{ ok: false, reason, cause, next }` (exit 1).
`reason` is `print-dispatch-disabled`, `agent-unavailable`,
`agent-exit-nonzero`, `result-missing`, `result-error`, `report-missing`
(the final `result` is absent or blank), `dispatch-input-invalid`, `role-document-invalid`, `tier-unmapped`, or `role-config-invalid`. Follow `next`; do not
assemble the identity line, role body, or `agent --print` argv in the
session. Invalid argv (`print` missing, unknown `--role`, duplicate or
missing `--role`/`--cwd`/`--input`/`--out`) is exit 2.

Do not invent a strategy when the command fails.
