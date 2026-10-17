# record

Contract card for the `coordinate next` action `record`, from the coordinator
Procedure step 3 (Drive). When the report's Brief revision does not match the
active dispatch, read the stale report rule in
[agent-dispatch](../../skills/bouncer-run/references/agent-dispatch.md) instead
of recording.

- Only an `accepted` report may run the `record` `argv` so `bouncer coordinate
  record` stores its result SHA together with a decision naming the paths the
  task actually changed.
- `record` stores the SHA and that decision, so provenance the ledger must
  keep travels inside the decision text.
- Confirm `payload.report` and read only `payload.evidence` pointers whose
  hashes still match before filling `judge.fields`; do not widen scope from
  those paths.
- Name the changed paths from the report file's `## Changed files`, not from
  the short hand-back; the file keeps that evidence and the `Red run` the
  reviewer reads, even when it omits empty optional sections.
- A missing Brief revision is refused by `coordinate report` as
  `report-revision-missing`; fix the report file first.
