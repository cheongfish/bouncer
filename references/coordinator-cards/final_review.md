# final_review

Contract card for the `coordinate next` action `final_review` (blueprint
review mode). When dispatching a final reviewer, applying its fallback, or
recording its model and tokens, read
[agent-dispatch](../../skills/bouncer-run/references/agent-dispatch.md): it owns
the CLI `perspectives` fan-out, the whole-role fallback, and the final-review
model and token records (no `--task`). This card keeps the final-review inputs
and Procedure step 6 (Close).

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
- In discovery, walk `perspectives` in CLI order per agent-dispatch. In a
  blueprint without `review_contract: brief` (legacy) the final review is this
  one discovery round: there is no delta round for it (`review-dispatch execute --mode delta` without `--task` exits
  2, and `review record` rejects a new root delta as
  `final-review-single-round`). In a blueprint with `review_contract: brief`
  (full blueprints only) the perspectives are `spec_scope` and
  `correctness_tests`, plus `security` only when `review_risk` has
  `authentication`, `authorization`, or `credential` (a legacy blueprint appends
  `security` for any non-empty `review_risk`), and one repair and one delta
  follow (see the marked flow below).
- Give each reviewer every commit task brief (Goal & intent, Current behavior,
  Target behavior, Interface, Touch, Do not touch, Constraints, Checklist; an
  absent optional behavior section is omitted) and the blueprint Contract.
- Record `bouncer.review.findings[]` and `rounds[]` on the blueprint-root
  `review.md` with `bouncer review record --blueprint <dir> --round
  <json-file>` (omit `--task`; add `--status` only when changing document
  status). Do not edit that YAML by hand. Check `warnings` in the result: each `finding-merge-candidate`
  lists findings on the same file and symbol under different categories; decide
  whether to merge them. Each round records `target` (`base`,
  `head`), `task_brief_hashes` (commit task id → brief hash),
  `intent_bundles` (commit task id → `{ id, revision }`), and each
  perspective's `target_head`.
- Marked blueprint (`review_contract: brief`): judge against the approved
  brief's eight sections and the blueprint Contract. A `must_fix` is only a
  brief violation (change outside Do not touch or `affected_paths`, Interface
  provision or refusal violated, Constraints breach, Checklist skipped or an
  assertion looser than the brief, an unmet Contract failure mode, or a defect
  of the open security risk) and its `brief_clause` starts with
  `tasks/<NNN> <section>` (a brief section name) or `Contract`. Lower any other
  reviewer `must_fix` to `advisory` and record `no-brief-clause` or
  `not-brief-violation` in `severity_changes`; new design or refactoring
  opinions are `advisory`. Order: discovery; when a `must_fix` exists, one
  `coordinate repair --review-finding` carrying every violation finding (inside
  approved paths; `newPaths` only outside every Do not touch line); terminal re-verification; then `coordinate
  next` returns a delta `final_review` (`--mode delta`, `combined`, one
  reviewer); record it `accepted`, or `final-review-blocked` when a finding
  remains. In a brief blueprint, a remaining `minor` or `nit` `must_fix` is recorded as `deferred` with a `note` when the delta round is first recorded with `--status accepted`; once the delta round is stored, any remaining finding is closed with `review accept-risk` after user approval or stops with `final-review-blocked`. There is no second repair: it is refused as `final-review-single-round`
  (`final-review-repair-do-not-touch` when the first repair declares `newPaths` under a Do not touch line; other `newPaths` are accepted and recorded as `unexpected_paths`);
  report the refusal as blocked. Record `advisory` findings
  `accepted`, or `deferred` with a `note`, and carry them as warnings in the
  final report. A marker problem surfaces as `review-contract-invalid`.
- Legacy blueprint (no `review_contract: brief`): classify every finding after
  the discovery round, in this order:
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
  - Only after the user explicitly approves accepting the risk of a blocked
    finding, run `bouncer review accept-risk --blueprint <dir> --finding <id>
    --note <reason> --yes`. It records that finding `accepted` with
    `accepted_risk: true` without adding a round, and the document becomes
    `accepted` once no open finding remains. Never run it without that
    explicit user approval.
- A terminal verification task that is `verifying` with a proven `outside_scope`
  classification is a separate completion reason: `next` reaches this action
  with `payload.outside_scope`. Review as usual, keep the failure (never call
  it passed or integrated), and carry it as a warning in the final report.
  A stale or unproven classification stays `blocked`.
- A terminal failure caused by the environment only is re-run with
  `coordinate reverify --task <terminal>` (no repair wave); a failure that
  needs a code change still goes through `repair`.
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
| `accepted` | risk accepted, `note` required; a `blocked` finding gets this only through `review accept-risk` (sets `accepted_risk: true`) after explicit user approval |
| `deferred` | follow-up plan independent of the current task, `note` required |

| document `--status` | meaning |
| --- | --- |
| `requested` | the review is open; a `blocked` finding keeps it here until the user decides |
| `accepted` | the discovery round is done and no finding is `open`; closes the review |

Final review order:

Legacy blueprint (no `review_contract: brief`):

1. Discovery round: record a `blocked` finding as `open` with `--status
   requested`; record every other `must_fix` as `deferred` with a `note` and
   `--status accepted`.
2. A stored discovery round ends the review's rounds: no delta round follows.

Marked blueprint (`review_contract: brief`):

1. Discovery round: with no `must_fix`, record `--status accepted`.
2. With a `must_fix`: one `coordinate repair --review-finding` for all
   violation findings, terminal re-verification, then the delta `final_review`
   from `coordinate next`.
3. Delta round: `accepted`, or `final-review-blocked` when a finding remains.
   In a brief blueprint, a remaining `minor` or `nit` `must_fix` is recorded as `deferred` with a `note` when the delta round is first recorded with `--status accepted`; once the delta round is stored, any remaining finding is closed with `review accept-risk` after user approval or stops with `final-review-blocked`.
   No second repair follows.

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
