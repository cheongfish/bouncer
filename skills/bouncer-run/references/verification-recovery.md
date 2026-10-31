On verify failure, when recovering through debugger then implementer, read this reference.
Apply [`${BOUNCER_ROOT}/rules/subagent-model.md`](../../../rules/subagent-model.md).

One first in-scope fix is allowed per task; after it, every verify failure goes to `bouncer-debugger`.
Find the first-fix record in the `## Verify recovery` section of this task's report files.

If this is the task's first verify failure and the first failing file/line or assertion is inside its `affected_paths`, the controller sends the failing command, first failure point, and scope judgment to the implementer. Continue the same implementer session when the host can message that live session; otherwise start a new session. The implementer fixes only within the task brief and writes those same three values plus the fix to `## Verify recovery` in its task report. For a new session, first record `coordinate report --outcome rework` with the failing command and first failure point, then dispatch the next attempt. For the same session, dispatch and report are unnecessary: run `coordinate next` to obtain `verify` and re-verify.

The first-fix record is a populated `## Verify recovery` entry containing the failing command, first failure point, scope judgment, and fix. An empty section or `- none` does not consume the first fix. The record is in the task report, not the ledger's `rework` summary.

Use the debugger path when the first fix was already used, the cause is unclear or outside the task's scope, or several task contracts are involved. Scope decisions remain with the controller; coordinator workers do not edit directly.

When dispatching `bouncer-debugger` or applying its fallback, read
[agent-dispatch](./agent-dispatch.md): its `## Debugger dispatch` section owns
the named payload, the whole-role generic or inline fallback, and the rule that
debugger dispatch stays named; its `## Worker model and
token records` section owns the debugger model and token records.

The debugger must not edit files, commit, or flip status. It returns a root-cause
report only: **Reproduction**, **Evidence**, **Single hypothesis**,
**Minimum fix proposal**, **Required regression test**, and
**Scope/task impact**. Then sequentially re-dispatch `bouncer-implementer` with
the same task-brief authority, the same bundle identifiers, and the debugger
Output contract as evidence. Under a coordinator drive that re-dispatch crosses
the same report→dispatch metadata boundary: judge the prior attempt with
`coordinate report`, revise only when the outcome requires it, then open a new
`coordinate dispatch` so the implementer receives the increased `attempt`,
`task_brief_hash`, `base_head`, `initial_worktree_state`, and
`previous_outcome` before applying the minimum fix. Apply only the proposed
minimum fix and required regression test inside `affected_paths`; Scope/task
impact is controller-only decision input. Do not stack alternatives or treat
the report as authority. Then re-verify.

When re-verify fails again, the cycle is over: do not retreat to `/bouncer-plan` mid-drive and do not start a third round. Hand the debugger's Reproduction, Single hypothesis and Scope/task impact to the controller. Under a coordinator drive that becomes exactly one recorded decision — rework with a named cause, a scope revision through `bouncer coordinate revise`, a task change, or terminal blocked when repeated attempts stop moving the failure.
