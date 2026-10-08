# final_review

Contract card for the `coordinate next` action `final_review` (blueprint
review mode). Rules are copied from the coordinator Worker dispatch final
review and Procedure step 6 (Close).

- When `next` returns `final_review`, run that `argv` (`review-dispatch
  execute`) once through this final-review procedure, record the round from
  `judge` `review-round`, then call `next` again. Do not Close while that root
  `review.md` is not `accepted`.
- Blueprint review mode is `bouncer.review_scope: blueprint` on blueprint
  `index.md`. In that mode do **not** dispatch a per-task execute reviewer.
  Open one final review after every commit task is integrated and the terminal
  verification task (when present) is `integrated`, and before Close. Freeze
  `base` as the drive dispatch payload base SHA and `head` as the integration
  HEAD, then run `bouncer review-dispatch execute --blueprint <dir> --base
  <sha> --head <sha>` (no `--task`). Use that CLI JSON's `strategy`,
  `perspectives` order, and `risk_flags` exactly — do not recompute file/line
  stats, guess risk from path names or diff bodies, or override the returned
  list. On `ok: false`, when the returned `target` mismatches the frozen
  base/head, or when `risk_flags` disagree with the union of commit-task
  `review_risk`, stop — do not open a review round, do not call reviewers, and
  do not record the review `accepted`.
- Walk the CLI `perspectives` array in order as the only discovery fan-out —
  do not also branch on `strategy` to invent calls, and do not append
  `security` from `risk_flags` separately (the CLI list already includes it
  when required; for example small risk → `combined` then `security`). Named
  and fallback review paths walk the same `perspectives` sequence.
- Give each reviewer every commit task brief (Goal & intent, Interface, Touch,
  Do not touch, Constraints, Checklist) and the blueprint Contract.
- Record `bouncer.review.findings[]` and `rounds[]` on the blueprint-root
  `review.md` with `bouncer review record --blueprint <dir> --round
  <json-file>` (omit `--task`; add `--status` only when changing document
  status). Do not edit that YAML by hand. Each round records `target` (`base`,
  `head`), `task_brief_hashes` (commit task id → brief hash),
  `intent_bundles` (commit task id → `{ id, revision }`), and each
  perspective's `target_head`.
- When must_fix remains, open one repair with `bouncer coordinate repair …
  --review-finding <id>` (repeat the flag per finding) so one repair task
  fixes every must_fix. Re-run the terminal verification, then freeze the same
  `base` and the post-repair integration HEAD and call `review-dispatch` once
  for delta — do not reopen discovery. Fail-closed compares against that
  round's frozen target.
- If repair returns `repair-wave-limit`, put the open must_fix findings in the
  Blocked report, end `blocked`, and do not record the review `accepted`. A
  finding that needs a new product decision, dependency, or public interface
  is `blocked`, not a repair. Delta certification still runs once without a
  discovery perspective; critical recovery stays the drive-only one-fix
  ceiling.

## Print dispatch input

When `.bouncer/config.json` has `subagents.provider: "cursor"` and
`subagents.dispatch: "print"`, write only a `--input` text file. Pass cwd
as `--cwd`. `bouncer dispatch print` prepends identity and the role body.
Do not read `${BOUNCER_ROOT}/agents/*.md`, `reviewer-prompt.md`, or `review-rounds.md`.

`--input` file, in this order: Mode, Perspective, Strategy, Risk flags,
Target, Brief (every commit task brief plus the blueprint Contract),
Intent sections, Constraints, then delta inputs when mode is delta.

## Finding status

Finding `status` (in each `findings[]` entry) is separate from the review
document `--status` (`review record --status`).

| finding `status` | meaning |
| --- | --- |
| `open` | confirmed but not fixed yet; the document cannot be `accepted` while any finding is `open` |
| `resolved` | fixed in the diff |
| `accepted` | risk accepted, `note` required |
| `deferred` | follow-up plan independent of the current task, `note` required |

| document `--status` | meaning |
| --- | --- |
| `requested` | the review is open |
| `addressed` | fixes applied, waiting for re-confirmation |
| `accepted` | everything resolved; closes the review |

Repair wave order:

1. Discovery round: record a must_fix not yet fixed as `open` and the document
   `--status requested`.
2. Fix: on the blueprint path open `coordinate repair --review-finding <id>`.
3. Delta round: send that finding again with every field, `status: resolved`,
   `last_seen_round` of the new round, and `--status accepted`.

Discovery round (`--status requested`):

```json
{
  "round": {
    "round": 1,
    "mode": "discovery",
    "target": {
      "base": "aaa",
      "head": "bbb"
    },
    "perspectives": [
      {
        "name": "combined",
        "target_head": "bbb"
      }
    ],
    "task_brief_hashes": {
      "TASKS-001": "<hash>"
    },
    "intent_bundles": {
      "TASKS-001": {
        "id": "<id>",
        "revision": 1
      }
    },
    "previous_finding_ids": [],
    "new": 1,
    "resolved": 0,
    "regressed": 0
  },
  "findings": [
    {
      "id": "F1",
      "severity": "major",
      "status": "open",
      "category": "correctness",
      "brief_clause": "tasks/001 Interface",
      "file": "scripts/lib/x.js",
      "symbol": "f",
      "fingerprint": "correctness:tasks/001 interface:scripts/lib/x.js#f",
      "actionability": "must_fix",
      "origin": "discovery",
      "first_seen_round": 1,
      "last_seen_round": 1
    }
  ]
}
```

Delta round (`--status accepted`):

```json
{
  "round": {
    "round": 2,
    "mode": "delta",
    "target": {
      "base": "aaa",
      "head": "ccc"
    },
    "task_brief_hashes": {
      "TASKS-001": "<hash>"
    },
    "intent_bundles": {
      "TASKS-001": {
        "id": "<id>",
        "revision": 1
      }
    },
    "previous_finding_ids": [
      "F1"
    ],
    "new": 0,
    "resolved": 1,
    "regressed": 0
  },
  "findings": [
    {
      "id": "F1",
      "severity": "major",
      "status": "resolved",
      "category": "correctness",
      "brief_clause": "tasks/001 Interface",
      "file": "scripts/lib/x.js",
      "symbol": "f",
      "fingerprint": "correctness:tasks/001 interface:scripts/lib/x.js#f",
      "actionability": "must_fix",
      "origin": "discovery",
      "first_seen_round": 1,
      "last_seen_round": 2
    }
  ]
}
```
