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
   the same role brief. The same role brief is the entire body of the role
   document `agents/bouncer-<role>.md` — every section from Authority through
   Output contract, verbatim — plus the calling workflow's controller input
   for that call, including its actual cwd. A generic fallback carries both in
   its payload; an inline pass first reads that role document and follows
   every section before it judges or edits. A payload that carries only the
   role name, a summary, or a label such as "same brief" or "same prompt" is
   not a fallback payload. The fallback keeps the named role's boundary: a
   read-only role stays read-only, and no fallback gains write, status, scope,
   pointer, or commit authority the named role lacks. The full body is for the
   fallback only; a named dispatch already loads its role file and does not
   carry the body. This unsupported-host fallback follows the named dispatch
   attempt; it does not replace it merely because a host supports a different
   agent mechanism.
5. `/bouncer-run` resolves `bouncer-coordinator` through steps 1-4 like any
   other named agent, and its `subagents.<provider>` slot carries the same
   `inherit` meaning. The unsupported-host fallback for that dispatch is one
   generic subagent carrying the whole coordinator role — the entire body of
   `agents/bouncer-coordinator.md`, every section from Authority through Output
   contract, with its authority, hard guards, worker dispatch, and the
   worktree write boundary — plus the `/bouncer-run` dispatch payload exactly as
   `skills/bouncer-run/SKILL.md` step 4 defines it; this rule does not restate
   that list. It is never a shortened brief.

No workflow may add a provider setting or a subagent helper while applying this
contract. Light and `/bouncer-run` exceptions remain with the execute workflow,
not with this shared model rule.
