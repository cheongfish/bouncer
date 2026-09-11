When a review round may start or stop, read this reference.

The normal ceiling is **discovery wave 1회, fix batch 1회, delta certification 1회**.
The controller owns `review.md` records and status transitions; reviewers
return findings only. Do not give a discovery reviewer another reviewer's
findings.

```text
1 freeze    Pin base, HEAD, task-brief revision, and latest verify result.
            Do not modify implementation until discovery completes.
2 discover  Dispatch spec_scope, correctness_tests, and
            minimality_maintainability in parallel; dispatch security only when
            the changed surface makes it relevant.
3 aggregate Verify evidence, merge duplicate fingerprints, record
            severity_changes and origin, then decide must_fix or advisory from
            the brief, evidence, and changed range — never a reviewer vote.
4 fix       Dispatch one implementer once with a repair brief containing every
            must_fix finding.
5 verify    Re-run latest verify.
6 certify   Dispatch one delta reviewer with previous findings and revision diff.
7 outcome   All must_fix resolved and verify passed: accepted.
```

## Round ledger contract

The controller records every state transition in `review.md` under
`bouncer.review.rounds[]`. Every round records its frozen `target` (`base` and
`head`), `previous_finding_ids`, `new` / `resolved` / `regressed` counts,
revision, and latest verify result. Each reviewer perspective records the same
`target_head` as that round's target. Findings record a stable fingerprint,
`severity_changes`, `actionability`, disposition, origin, and the first and
last round where they were seen.

- `mode: discovery` is the first, parallel evidence-collection round. Findings
  first seen here use `origin: discovery`.
- `mode: delta` is certification against the repair revision and prior finding
  IDs. A finding first seen in a delta round uses `origin:
  introduced_by_revision`, or `origin: missed_critical` only when its severity
  is `blocker` or `major`.
- `mode: critical_recovery` records the drive-only repair state entered by a
  qualifying delta blocker or major; it is not another discovery wave. Preserve
  the triggering finding's origin and IDs, run the one repair and verify, then
  record the final delta certification.

The only complete mode sequences are `discovery`, `discovery → delta`, and the
drive-only recovery sequence `discovery → delta → critical_recovery → delta`.
An `advisory` is recorded once as `accepted` or `deferred` with a note; it never
opens another implementer dispatch. Do not classify a current-task accuracy
finding as `deferred` or `advisory`; an unresolved finding is never recorded as
done.

After certification, a new blocker or major with an allowed origin uses one
**critical recovery** only in a drive: one fix, verify, and final delta each.
Outside a drive, report the open finding to the user and direct them to
`/bouncer-plan`; do not run critical recovery automatically. A minor or nit
created by the revision is advisory unless it affects correctness, in which
case it remains must_fix and the task is `blocked`. Conflicting findings, or a
new design, dependency, public Interface, or scope requirement, is `blocked`;
under a drive, hand the coordinator the open findings to disposition.
Never repeat full discovery after delta certification or split findings into
separate implementer dispatches.
