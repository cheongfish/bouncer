# verify

Contract card for the `coordinate next` action `verify`. When verification
fails and recovery runs, read
[verification-recovery](../../skills/bouncer-run/references/verification-recovery.md).
Before dispatching `bouncer-debugger` or applying its fallback, read
[agent-dispatch](../../skills/bouncer-run/references/agent-dispatch.md): it owns
the debugger payload, the whole-role fallback, and the debugger model and token
records.

- **Verify and execute gate.** From the worker cwd run `next`'s `argv`
  (`bouncer validate --blueprint <dir> --gate execute`). That run executes
  verify, records evidence, and transitions `ready` → `verified`. Do not
  hand-edit task status or `verification.md`. Never hand-write `## Command`,
  `## Evidence`, or status. Keep fixing until the gate passes.

## Verify failure

- One first in-scope fix is allowed per task; after it, every verify failure goes to `bouncer-debugger`.
- Find the first-fix record in the `## Verify recovery` section of this task's report files.
- If this is the task's first verify failure and the first failing file/line or assertion is inside its `affected_paths`, the controller sends the failing command, first failure point, and scope judgment to the implementer. Continue the same implementer session when the host can message that live session; otherwise start a new session. The implementer fixes only within the task brief and writes those same three values plus the fix to `## Verify recovery` in its task report. For a new session, first record `coordinate report --outcome rework` with the failing command and first failure point, then dispatch the next attempt. For the same session, dispatch and report are unnecessary: run `coordinate next` to obtain `verify` and re-verify.
- A task report consumes its first fix only when `## Verify recovery` contains one populated record with the failing command, first failure point, scope judgment, and fix. An empty section or `- none` does not consume it. The first-fix record is the task report section, not the ledger's `rework` summary.
- Use the debugger path when the first fix was already used, the cause is unclear or outside the task's scope, or several task contracts are involved. Scope decisions remain with the controller; coordinator workers do not edit directly.
- Dispatch named `bouncer-debugger` (plugin `${BOUNCER_ROOT}/agents/bouncer-debugger.md`)
  per the agent-dispatch `## Debugger dispatch` section, after recording its
  model per `## Worker model and token records`. The debugger receives the
  failing verify evidence and the assigned read-only cwd.
- The debugger must not edit files, commit, or flip status. It returns a
  root-cause report only: **Reproduction**, **Evidence**, **Single
  hypothesis**, **Minimum fix proposal**, **Required regression test**, and
  **Scope/task impact**. Then sequentially re-dispatch `bouncer-implementer`
  with the same task-brief authority, the same bundle identifiers, and the
  debugger Output contract as evidence. Under a coordinator drive that
  re-dispatch crosses the same report→dispatch metadata boundary: judge the
  prior attempt with `coordinate report`, revise only when the outcome
  requires it, then open a new `coordinate dispatch` so the implementer
  receives the increased `attempt`, `task_brief_hash`, `base_head`,
  `initial_worktree_state`, and `previous_outcome` before applying the minimum
  fix. Apply only the proposed minimum fix and required regression test inside
  `affected_paths`; Scope/task impact is controller-only decision input. Do
  not stack alternatives or treat the report as authority. Then re-verify.
- When re-verify fails again, the cycle is over: do not retreat to
  `/bouncer-plan` mid-drive and do not start a third round. Hand the
  debugger's Reproduction, Single hypothesis and Scope/task impact to the
  controller. Under a coordinator drive that becomes exactly one recorded
  decision — rework with a named cause, a scope revision through `bouncer
  coordinate revise`, a task change, or terminal blocked when repeated
  attempts stop moving the failure.
