When dispatching a named agent or applying its fallback, read this reference.
Apply [`rules/subagent-model.md`](../../../rules/subagent-model.md).

Dispatch named `bouncer-implementer` (plugin `agents/bouncer-implementer.md`) with the task-brief authority named by execute. If named agents are unavailable, fall back to `implementation` inline or a fresh generic subagent with the same brief. The inline fallback still receives G6–G8 judgment after verify and review.

For the verify-recovery implementer re-dispatch, use the same named-dispatch order. Only outside `/bouncer-run`, the light path may use the step-3 inline implementation branch; `/bouncer-run` always retains the named orchestration boundary.

For review, dispatch named `bouncer-reviewer` with the reviewer prompt. If named agents are unavailable, fall back to a fresh generic subagent or inline read-only pass using that prompt. Reviewers remain named regardless of scale.
