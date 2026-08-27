# Subagent model and host fallback

This is the shared contract for every named Bouncer-agent dispatch. It covers
only model selection and host fallback; each calling workflow keeps ownership
of the agent role, its inputs and outputs, read-only permissions, and retry
limits.

1. Resolve the named agent's model with `resolveSubagentModel`. Its return is
   an object: extract and pass only `result.model` to the named dispatch, never
   the complete result (which also carries provider metadata). When
   `result.model` is `null`, omit the model argument so the named dispatch keeps
   parent-session inheritance. `inherit`, `null`, and every non-string
   configured value have that inheritance meaning; they are not a request to
   select a replacement model.
2. Attempt the named dispatch. Do not skip it because the host is Codex.
3. Only on a rejected model slug, retry that same named dispatch once with
   `inherit`, and tell the user that the slug was refused.
   A dispatch failure for another reason does not authorize this retry.
4. When named agents are unavailable, use the fallback explicitly selected by
   the calling workflow (inline skill/pass or a fresh generic subagent) with
   the same role brief. This unsupported-host fallback follows the named
   dispatch attempt; it does not replace it merely because a host supports a
   different agent mechanism.

No workflow may add a provider setting or a subagent helper while applying this
contract. Light and `/bouncer-run` exceptions remain with the execute workflow,
not with this shared model rule.
