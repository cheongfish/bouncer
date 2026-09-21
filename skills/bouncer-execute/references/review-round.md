When a review round may start or stop, read this reference.

The normal ceiling is **discovery wave 1회, fix batch 1회, delta certification 1회**.
The controller owns `review.md` records and status transitions; reviewers
return findings only. Do not give a discovery reviewer another reviewer's
findings.

```text
1 freeze    Pin base, HEAD, task-brief revision, task_brief_hash,
            intent_bundle_id, intent_bundle_revision, intent_sections, and
            latest verify result. Do not modify implementation until discovery
            completes. Do not mix different brief hash or bundle revision
            values in one round, and do not pass the full Explain body into
            discovery or delta payloads.
2 discover  Run `bouncer review-dispatch execute --blueprint <dir> --task <NNN>
            --base <frozen-base> --head <frozen-head>`. That CLI result is the
            only discovery dispatch authority: do not recompute file/line
            stats, guess risk from path names or diff bodies, merge or split
            perspectives, or override `strategy` / `perspectives` /
            `risk_flags`. When the payload is `ok: false`, or when its
            `target.base` / `target.head` / `target.task` disagree with the
            frozen values, or when `risk_flags` disagree with the current
            task's `review_risk`, stop — do not open a review round and do not
            mark the review accepted.

            Dispatch discovery reviewers by walking the CLI `perspectives`
            array in order — that list is the only fan-out. Do not also branch
            on `strategy` to invent calls, and do not append `security` from
            `risk_flags` separately; the CLI already placed those choices in
            `perspectives` (for example `single` without risk → `combined`;
            small risk → `combined` then `security`; `parallel` without risk →
            `spec_scope`, `correctness_tests`, `minimality_maintainability`;
            large risk → those three then `security`). Record round 1
            perspectives in that CLI order. Each discovery call receives the
            same frozen target, task_brief_hash, intent bundle identifiers,
            intent_sections, and latest verify — never another reviewer's
            findings.
3 aggregate Verify evidence, merge duplicate fingerprints, record
            severity_changes and origin, then decide must_fix or advisory from
            the brief, evidence, and changed range — never a reviewer vote.
4 fix       Under a coordinator drive: judge the prior implementer report
            (`coordinate report`), revise only when the outcome requires it,
            then open a new `coordinate dispatch` so the fix implementer
            receives the increased attempt, task_brief_hash, base_head,
            initial_worktree_state, and previous_outcome. Outside a drive,
            dispatch one implementer once with a repair brief containing every
            must_fix finding.
5 verify    Re-run latest verify.
6 certify   Dispatch one delta reviewer with previous findings, resolution,
            and revision diff only — never a discovery perspective and never a
            second strategy-shaped fan-out.
7 outcome   All must_fix resolved and verify passed: accepted.
```

## Round ledger contract

The controller records every state transition in `review.md` under
`bouncer.review.rounds[]`. Every round records its frozen `target` (`base` and
`head`), `task_brief_hash`, `intent_bundle_id`, `intent_bundle_revision`,
`intent_sections`, `previous_finding_ids`, `new` / `resolved` / `regressed`
counts, revision, and latest verify result. Each reviewer perspective records
the same `target_head` as that round's target and the same bundle identifiers.
Findings record a stable fingerprint, `severity_changes`, `actionability`,
disposition, origin, and the first and last round where they were seen.

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
