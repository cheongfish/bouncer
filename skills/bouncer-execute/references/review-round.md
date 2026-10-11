When a review round may start or stop, read this reference.

The normal ceiling is **discovery wave 1회, fix batch 1회, delta certification 1회**.
The controller owns `review.md` records and status transitions; reviewers
return findings only. Do not give a discovery reviewer another reviewer's
findings.

Blueprint review mode is `bouncer.review_scope: blueprint` on blueprint
`index.md`. When `review_scope` is absent, keep the existing per-task
procedure (pointer-task `review.md`, `--task <NNN>`).

```text
1 freeze    Pin base, HEAD, task-brief revision(s), latest verify, and
            either the single-task identifiers (task_brief_hash,
            intent_bundle_id, intent_bundle_revision, and intent_sections from
            `bouncer intent sections --task <current.task.path> --role reviewer`) or,
            in blueprint review mode, task_brief_hashes (commit task id →
            brief hash) and intent_bundles (commit task id → { id, revision }).
            Do not modify implementation until discovery completes. Do not
            mix different brief hash or bundle revision values in one round,
            and do not pass the full Explain body into discovery or delta
            payloads.

            Standalone last-commit final review (blueprint review mode):
            base is `git merge-base <bouncer current base> HEAD`; head is
            HEAD; the reviewed diff is `git diff <base>` plus untracked
            files for the whole worktree. A coordinator final review uses
            the drive payload base SHA and the integration HEAD.

2 discover  When `review_scope` is absent, run
            `bouncer review-dispatch execute --blueprint <dir> --task <NNN>
            --base <frozen-base> --head <frozen-head>`. In blueprint review
            mode run `--blueprint <dir> --base <frozen-base> --head
            <frozen-head>` with no `--task`. That CLI result is the
            only discovery dispatch authority: do not recompute file/line
            stats, guess risk from path names or diff bodies, merge or split
            perspectives, or override `strategy` / `perspectives` /
            `risk_flags`. When the payload is `ok: false`, or when its
            `target.base` / `target.head` (and `target.task` on the
            per-task path) disagree with the frozen values, or when
            `risk_flags` disagree with the current task's `review_risk`
            (per-task path) or the union of commit-task `review_risk`
            (blueprint review mode), stop — do not open a review round and
            do not mark the review accepted.

            Dispatch discovery reviewers by walking the CLI `perspectives`
            array in order — that list is the only fan-out. Do not also branch
            on `strategy` to invent calls, and do not append `security` from
            `risk_flags` separately; the CLI already placed those choices in
            `perspectives` (for example `single` without risk → `combined`;
            small risk → `combined` then `security`; `parallel` without risk →
            `spec_scope`, `correctness_tests`, `minimality_maintainability`;
            large risk → those three then `security`). Record round 1
            perspectives in that CLI order. Each discovery call receives the
            same frozen target, brief hash / bundle identifiers,
            intent_sections from
            `bouncer intent sections --task <current.task.path> --role reviewer`,
            and latest verify — never another reviewer's
            findings. In blueprint review mode the payload also carries every
            commit task brief and the blueprint Contract.
3 aggregate Verify evidence, merge duplicate fingerprints, record
            severity_changes and origin, then decide must_fix or advisory from
            the brief, evidence, and changed range — never a reviewer vote.
4 fix       Under a coordinator drive in blueprint review mode: open one
            `bouncer coordinate repair … --review-finding <id>` task that
            fixes every must_fix together. Do not use that repair for a
            finding that needs a new product decision, dependency, or public
            interface — those stay blocked. A must_fix that is only an
            in-scope gap in test evidence (test paths inside an integrated
            task's `affected_paths`, product behavior already correct) is
            instead supplemented in place with `coordinate repair --kind
            supplement`: no new task or repair wave, then the one delta round.
            Under a coordinator drive on the
            per-task path: judge the prior implementer report
            (`coordinate report`), revise only when the outcome requires it,
            then open a new `coordinate dispatch` so the fix implementer
            receives the increased attempt, task_brief_hash, base_head,
            initial_worktree_state, and previous_outcome. Outside a drive,
            dispatch one implementer once with a repair brief containing every
            must_fix finding; stay inside the pointer task's `affected_paths`.
            A must_fix that needs any other path stays open: report it to the
            user and send them to `/bouncer-plan`.
5 verify    Re-run latest verify (standalone) or the terminal verification
            (coordinator final review).
6 certify   Dispatch one delta reviewer with previous findings, resolution,
            and revision-origin evidence — never a discovery perspective and never a
            second strategy-shaped fan-out. Delta keeps the frozen base and
            pins head to HEAD after the fix (standalone) or the post-repair
            integration HEAD (drive). Standalone blueprint-mode delta reviews
            the whole worktree (`git diff <base>` plus untracked after the
            fix), not only the repair hunks. Fail-closed compares against that
            round's frozen target.
7 outcome   All must_fix resolved and verify passed: accepted.
```

## Round ledger contract

완결된 `rounds[]` 예제는 `${BOUNCER_ROOT}/references/spec-authoring/review-rounds.md`를 본다.
Do not edit `review.md` YAML by hand. Record every state transition with
`bouncer review record --blueprint <dir> [--task <ddd>] --round <json-file>
[--status <requested|addressed|accepted>]` into `bouncer.review.rounds[]` and
`bouncer.review.findings[]`. In blueprint review mode that file
is the blueprint-root `review.md` (omit `--task`); when `review_scope` is
absent pass `--task <NNN>` for `<pointer task directory>/review.md`. Every
round JSON records its frozen `target`
(`base` and `head`), `task_brief_hash` or `task_brief_hashes`,
`intent_bundle_id` / `intent_bundle_revision` or `intent_bundles`,
`intent_sections` from
`bouncer intent sections --task <current.task.path> --role reviewer`,
`previous_finding_ids`, `new` / `resolved` / `regressed`
counts, revision, and latest verify result. Each reviewer perspective records
the same `target_head` as that round's target and the same bundle identifiers.
Findings record a stable fingerprint, `severity_changes`, `actionability`,
disposition, origin, and the first and last round where they were seen.
The command fills a missing `fingerprint` and writes only when the gate
checks pass. On `{ ok: false }`, follow `reason` / `next`; do not recover by
editing frontmatter or reading validator sources.

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
finding as `deferred` or `advisory`. An unresolved finding is never recorded as
done: record it as `open` while the review is `requested`, then change it to
`resolved` in the delta round before the review becomes `accepted` — an `open`
finding cannot remain in an `accepted` review.

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
