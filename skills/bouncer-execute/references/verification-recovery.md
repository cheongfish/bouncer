On verify failure, when recovering through debugger then implementer, read this reference.
Apply [`rules/subagent-model.md`](../../../rules/subagent-model.md).

Dispatch named `bouncer-debugger` (plugin `agents/bouncer-debugger.md`) with
the failing verify evidence, only the pointer task brief's Goal & intent,
Interface, Touch, Do not touch, Constraints, and Checklist, the shared
`task_brief_hash`, `intent_bundle_id`, `intent_bundle_revision`, the debugger's
`intent_sections` projection, and the assigned read-only cwd. Do not pass the
full Explain body or another role's report. The `debugging` skill remains its
behavioral brief. When named agents are unavailable, use a fresh generic
read-only subagent whose payload carries the entire body of
`agents/bouncer-debugger.md` — every section from Authority through Output
contract, verbatim — plus the failing verify evidence, the task brief's Goal & intent,
Interface, Touch, Do not touch, Constraints, and Checklist, the same
`task_brief_hash`, `intent_bundle_id`, `intent_bundle_revision`, and
`intent_sections`, and the assigned read-only cwd; or run `debugging` inline,
where the inline pass first reads `agents/bouncer-debugger.md` and follows
every section with those same inputs before it diagnoses. Even on the light
path, debugger dispatch remains named.

The debugger must not edit files, commit, or flip status. It returns a root-cause
report only: **Reproduction**, **Evidence**, **Single hypothesis**,
**Minimum fix proposal**, **Required regression test**, and
**Scope/task impact**. Then sequentially re-dispatch `bouncer-implementer` with
the same task-brief authority, the same bundle identifiers, and the debugger
Output contract as evidence. Apply only the proposed minimum fix and required
regression test inside `affected_paths`; Scope/task impact is controller-only
decision input. Do not stack alternatives or treat the report as authority.
Then re-verify.

When re-verify fails again, the cycle is over: do not retreat to `/bouncer-plan` mid-drive and do not start a third round. Hand the debugger's Reproduction, Single hypothesis and Scope/task impact to the controller. Under a coordinator drive that becomes exactly one recorded decision — rework with a named cause, a scope revision through `bouncer coordinate revise`, a task change, or terminal blocked when repeated attempts stop moving the failure.
