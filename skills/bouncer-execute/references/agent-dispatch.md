When dispatching a named agent or applying its fallback, read this reference.
Apply [`rules/subagent-model.md`](../../../rules/subagent-model.md).

## Named implementer

Before a **new named dispatch**, compare the temporary
`mdToCodexToml()` result for `agents/bouncer-implementer.md` byte-for-byte with
`.codex/agents/bouncer-implementer.toml`. Compact input is allowed only when
the local TOML starts with `# bouncer-generated` and is an exact match. A
mismatch may be refreshed through the existing `bouncer init
--seed-codex-agents` path, then compared again before starting a fresh named
dispatch; an already-running agent is never treated as refreshed.

When that check succeeds, dispatch named `bouncer-implementer` with the actual
worktree cwd and only the current task's Goal & intent, Interface, Touch, Do
not touch, Constraints, and Checklist. The generated role file already owns
the role instructions, so do not repeat them in the named payload. Do not add
historical commit subjects, earlier-task conversation, or Distill shards.

## Implementer fallback

If the TOML is missing, has a mismatch, is user-owned (no generated marker),
or named agents are unavailable, do not compact. Use `implementation` inline
or a fresh generic subagent with the actual worktree cwd, the six current-task
sections (Goal & intent, Interface, Touch, Do not touch, Constraints,
Checklist), and the full role guards: Authority, Hard guards, tests-first,
comments, and Output contract. These guards retain `affected_paths`, status,
and commit prohibitions on every fallback path. The inline fallback still
receives G6–G8 judgment after verify and review.

For the verify-recovery implementer re-dispatch, use the same named-dispatch order. Only outside `/bouncer-run`, the light path may use the step-3 inline implementation branch; `/bouncer-run` always retains the named orchestration boundary.

For review, dispatch named `bouncer-reviewer` with the reviewer prompt. If named agents are unavailable, fall back to a fresh generic subagent or inline read-only pass using that prompt. Reviewers remain named regardless of scale.
