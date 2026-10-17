# final_review

Contract card for the `coordinate next` action `final_review` (blueprint
review mode). Rules are copied from the coordinator Worker dispatch final
review and Procedure step 6 (Close).

- When `next` returns `final_review`, run that `argv` (`review-dispatch
  execute`) once through this final-review procedure, record the round from
  `judge` `review-round`, then call `next` again. Do not Close while that root
  `review.md` is not `accepted`.
- Immediately before each reviewer dispatch, run `bouncer subagent-model
  --agent bouncer-reviewer`, then record it with `bouncer coordinate
  worker-model --blueprint <dir> --role reviewer --model <value> [--perspective
  <name>] --ledger-path <p> --ledger-hash <h>` from the integration cwd (no
  `--task`: the final review spans the blueprint), and pass the same value to
  the dispatch. If a slug rejection forces the `inherit` retry, record the
  retried value again.
  The host's completion notice reports `subagent_tokens`. If the notice is not
  here yet, record without `--tokens`; once it arrives, append it with
  `bouncer coordinate worker-tokens --blueprint <dir> --role reviewer [--perspective <name>] --tokens <n>
  --ledger-path <p> --ledger-hash <h>` (same task and perspective). If the host
  gives no value, leave it out: it is counted as missing, never estimated.
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
- The returned `target.snapshot_id` and `target.snapshot_path` go into the
  existing Target slot (and the print `--input` Target) of every reviewer
  call, including the generic and print paths, and into the recorded round's
  `target.snapshot_id`; reviewers read that frozen artifact and never
  re-collect the change with `git diff`. The artifact is a runtime file the
  dispatch writes — source, index, and branch stay untouched. On a snapshot
  failure (`snapshot-missing`, `snapshot-corrupt`, target mismatch) or a
  `review record` rejection (`review-snapshot-stale`, `-mismatch`, `-invalid`,
  `-required`), follow `next`: dispatch a new snapshot, reclassify, and
  re-review; never edit status or rounds by hand to bypass it.
- In discovery, walk the CLI `perspectives` array in order as the only
  discovery fan-out — do not also branch on `strategy` to invent calls, and do
  not append `security` from `risk_flags` separately (the CLI list already
  includes it when required; for example small risk → `combined` then
  `security`). Named and fallback review paths walk the same `perspectives`
  sequence. The final review is this one discovery round: there is no delta
  round for it (`review-dispatch execute --mode delta` without `--task` exits
  2, and `review record` rejects a new root delta as
  `final-review-single-round`).
- Give each reviewer every commit task brief (Goal & intent, Interface, Touch,
  Do not touch, Constraints, Checklist) and the blueprint Contract.
- Record `bouncer.review.findings[]` and `rounds[]` on the blueprint-root
  `review.md` with `bouncer review record --blueprint <dir> --round
  <json-file>` (omit `--task`; add `--status` only when changing document
  status). Do not edit that YAML by hand. Check `warnings` in the result: each `finding-merge-candidate`
  lists findings on the same file and symbol under different categories; decide
  whether to merge them. Each round records `target` (`base`,
  `head`), `task_brief_hashes` (commit task id → brief hash),
  `intent_bundles` (commit task id → `{ id, revision }`), and each
  perspective's `target_head`.
- Classify every finding after the discovery round, in this order:
  `blocked` (needs a new product decision, dependency, or public interface)
  or any other finding. The CLI does not classify; you declare it.
  - A finding that is not `blocked` and is a `must_fix` is recorded
    `status: deferred` with a non-empty `note` (why it is carried forward),
    and the document is recorded `--status accepted`. Report each deferred
    `must_fix` as a warning in the final report; it does not stop the drive.
  - A `blocked` finding stays `status: open` and the document stays
    `--status requested`. `next` then returns `blocked` with reason
    `final-review-blocked`: show the open findings to the user and wait for
    their decision. Do not accept the review, run a delta round, open a
    review-caused `coordinate repair --review-finding`, or open
    `coordinate repair --kind supplement` — after the discovery round is
    stored those are refused with `final-review-single-round`.
- A terminal-verification (CI) failure still goes through `coordinate repair
  --failure-command` and its wave ceiling: `repair-wave-limit` ends `blocked`
  with the open findings in the Blocked report. That path is not review-caused
  and is unchanged. Critical recovery stays the drive-only one-fix ceiling.

## Print dispatch input

When `.bouncer/config.json` has `subagents.provider: "cursor"` and
`subagents.dispatch: "print"`, write only a `--input` text file. Pass cwd
as `--cwd`. `bouncer dispatch print` prepends identity and the role body.
Do not read `${BOUNCER_ROOT}/agents/*.md`, `reviewer-prompt.md`, or `review-rounds.md`.

`--input` file, in this order: Mode, Perspective, Strategy, Risk flags,
Target (including `snapshot_id` and `snapshot_path`), Brief (every commit
task brief plus the blueprint Contract),
Intent sections, Constraints, Red run.

`## Red run` holds one `TASKS-NNN: <value>` line for every commit task in the
review scope, in task-number order. Copy each task's `Red run` line from its
latest-attempt report file (`.bouncer/runtime/reports/<task>-<attempt>.md`)
verbatim, or write `TASKS-NNN: 미제공` when no report is found. A fix or repair
attempt's latest report replaces that task's earlier line.

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
| `requested` | the review is open; a `blocked` finding keeps it here until the user decides |
| `accepted` | the discovery round is done and no finding is `open`; closes the review |

Final review order:

1. Discovery round: record a `blocked` finding as `open` with `--status
   requested`; record every other `must_fix` as `deferred` with a `note` and
   `--status accepted`.
2. A stored discovery round ends the review's rounds: no delta round follows.

Discovery round (`--status accepted`, one `must_fix` carried forward as `deferred`):

```json
{
  "round": {
    "round": 1,
    "mode": "discovery",
    "target": {
      "base": "aaa",
      "head": "bbb",
      "snapshot_id": "<snapshot_id>"
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
      "status": "deferred",
      "note": "follow-up outside this blueprint scope",
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
