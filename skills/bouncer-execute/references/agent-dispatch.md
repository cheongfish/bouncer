When dispatching a named agent or applying its fallback, read this reference.

Resolve the model with `resolveSubagentModel` for `bouncer-implementer`, then call named agent `bouncer-implementer` (plugin `agents/bouncer-implementer.md`) with that model. If the host rejects the model slug, retry with `inherit` and tell the user. If named agents are unavailable, fall back to `implementation` inline or a fresh generic subagent with the same brief; do not skip named dispatch just because the host is Codex. The inline fallback still receives G6–G8 judgment after verify and review.

For the verify-recovery implementer re-dispatch, use the same named-dispatch order. Only outside `/bouncer-run`, the light path may use the step-3 inline implementation branch; `/bouncer-run` always retains the named orchestration boundary.

For review, resolve the model for `bouncer-reviewer`, dispatch that named agent, and retry `inherit` on a rejected slug. If named agents are unavailable, fall back to a fresh generic subagent or inline read-only pass using the reviewer prompt. Do not skip named dispatch because the host is Codex; reviewers remain named regardless of scale.
