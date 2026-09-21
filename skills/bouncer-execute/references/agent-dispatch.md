When dispatching a named agent or applying its fallback, read this reference.
Apply [`rules/subagent-model.md`](../../../rules/subagent-model.md).

Every named and fallback payload for implementer, debugger, and reviewer carries
the same `task_brief_hash`, `intent_bundle_id`, and `intent_bundle_revision`
from the controller's single preflight `bouncer intent bundle` resolve, plus a
role-specific `intent_sections` projection. Named and fallback receive identical
identifiers and the same role section set. Do not pass the full Explain body,
another task's bundle, or another role's report.

Under a coordinator drive, every implementer dispatch — named or fallback —
also carries the same five `coordinate dispatch` metadata fields: `attempt`,
`task_brief_hash`, `base_head`, `initial_worktree_state`, and when present
`previous_outcome` as `{ outcome, summary }`. Freeze the task brief while the
attempt is active: do not revise until after the implementer report is judged.
The implementer returns **Brief revision** with the same `attempt` and
`task_brief_hash`; a mismatch is stale — call `coordinate report` with the
received attempt and hash so runtime can append `stale-report`, and do not
treat it as accepted or call `coordinate record`.

## Named implementer

Before a **new named dispatch**, compare the temporary
`mdToCodexToml()` result for `agents/bouncer-implementer.md` byte-for-byte with
`.codex/agents/bouncer-implementer.toml`. Compact input is allowed only when
the local TOML starts with `# bouncer-generated` and is an exact match. A
mismatch may be refreshed through the existing `bouncer init
--seed-codex-agents` path, then compared again before starting a fresh named
dispatch; an already-running agent is never treated as refreshed.

When that check succeeds, dispatch named `bouncer-implementer` with the actual
worktree cwd and only the current task's Goal & intent, Current behavior,
Target behavior, Interface, Touch, Do not touch, Constraints, and Checklist
(omit any of those two behavior sections that the brief does not carry), plus
`task_brief_hash`, `intent_bundle_id`, `intent_bundle_revision`, and the
implementer's `intent_sections` projection. Under a coordinator drive also pass
`attempt`, `base_head`, `initial_worktree_state`, and when present
`previous_outcome` from `coordinate dispatch` — the same five metadata fields
as the fallback path — and require **Brief revision** in the report. The
generated role file already owns the role instructions, so do not repeat them
in the named payload. Do not add historical commit subjects, earlier-task
conversation, unselected context documents, or the full Explain body.

Under a coordinator drive the cwd is the task worktree `bouncer coordinate
prepare` assigned — never the integration worktree and never the main checkout
— and the eight sections come from the brief as the coordinator's latest `bouncer
coordinate revise` left it, not the approval snapshot (omit absent behavior
sections). Add nothing else about the drive: the coordinator context a worker
needs is its worktree, its current brief, the shared bundle identifiers, the
dispatch metadata above, and the fact that its report goes back to the
coordinator. Other tasks' briefs, the ledger, and other workers' reports stay out of the payload.

## Implementer fallback

If the TOML is missing, has a mismatch, is user-owned (no generated marker),
or named agents are unavailable, do not compact. Use a fresh generic subagent
whose payload carries the entire body of `agents/bouncer-implementer.md` —
every section from Authority through Output contract, verbatim, so its
Authority, Hard guards, tests-first, comments, and Output contract rules all
arrive — plus the actual worktree cwd and the eight current-task sections
(Goal & intent, Current behavior, Target behavior, Interface, Touch,
Do not touch, Constraints, Checklist — omit absent behavior sections), with the
same `task_brief_hash`, `intent_bundle_id`, `intent_bundle_revision`, and
`intent_sections` as the named path, and under a coordinator drive the same
five dispatch metadata fields (`attempt`, `task_brief_hash`, `base_head`,
`initial_worktree_state`, and conditional `previous_outcome`) so **Brief revision**
stays comparable. Or run `implementation` inline: the inline
pass first reads `agents/bouncer-implementer.md` and follows every section with
the same cwd and sections. Either path retains `affected_paths`, status, and
commit prohibitions. The inline fallback still receives G6–G8 judgment after
verify and review.

For the verify-recovery implementer re-dispatch, use the same named-dispatch order. Only outside `/bouncer-run`, the light path may use the step-3 inline implementation branch; `/bouncer-run` always retains the named orchestration boundary.

For review, freeze the target first (base, HEAD, task-brief revision,
`task_brief_hash`, `intent_bundle_id`, `intent_bundle_revision`, and latest
verify), then dispatch named `bouncer-reviewer` in parallel for `spec_scope`,
`correctness_tests`, and `minimality_maintainability`; add security only when
the changed surface requires it. Each discovery prompt contains only its own
rubric, the six brief sections, the reviewer's `intent_sections` projection,
the frozen target (including the shared bundle identifiers), and never another
reviewer's findings or the full Explain body. If named agents are unavailable,
dispatch fresh generic subagents in the same order, each carrying the entire
body of `agents/bouncer-reviewer.md` — every section from Authority through
Output contract, verbatim — plus its filled reviewer-prompt: frozen base and
HEAD, task brief revision, `task_brief_hash`, `intent_bundle_id`,
`intent_bundle_revision`, `intent_sections`, mode, perspective, latest verify,
and for delta the previous findings and revision diff, with the read-only cwd.
When no subagent tool exists, each inline read-only pass first reads
`agents/bouncer-reviewer.md` and follows every section with that input.
After one aggregate and one fix batch, dispatch exactly one delta reviewer with
previous findings and the revision diff. Reviewers remain named regardless of
scale.

Every worker returns its Output contract to the controller — the coordinator during a drive. Its **Scope impact** / **Scope/task impact** line is an input to one coordinator decision (scope revision through `bouncer coordinate revise`, rework, a task change, or terminal blocked), never a licence for the worker to widen its own scope or move the pointer.
