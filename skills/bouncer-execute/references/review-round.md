When a review round may start or stop, read this reference.

Review rounds follow this entry condition. Do not start a round unless it
holds:
```text
round <= 2
or (
  round == 3
  and previous blocker/major findings are resolved
  and latest verify passed
  and new actionable findings fit Goal, Interface, Constraints, affected_paths
)
```
Two rounds is the ceiling and a third runs only when that condition holds.
Never start a fourth round. Stop immediately — no round 3 — when after round 2 previous
blocker/major findings remain, latest verify failed, or new actionable
findings need a new design, dependency, public interface, or scope change.
Stop the same way after round 3 if any actionable finding remains, a finding
regresses, or a new design/scope is required. Either stop returns to the
controller: outside a drive, send the user to `/bouncer-plan`; under one,
hand the coordinator the open findings to
disposition. Do not fix again, do not re-review, and never flip a remaining
finding to `accepted` to clear it — an unresolved finding is never recorded
as done.

Treat every actionable finding that affects current-task accuracy — never
filter by severity. Do not classify those findings as `deferred`. `accepted` is an
authorized risk acceptance; `deferred` is an independent follow-up planning
item, and their notes must record those different reasons. Set
`review → accepted` only when every finding is `resolved`, or `accepted` or
`deferred` with a note.

After each executed round, append `bouncer.review.rounds[]`
with that round's previous finding IDs, `new` / `resolved` / `regressed`
counts, how findings were resolved, the revision, and the latest verify
result. Record that ledger in `review.md`.
