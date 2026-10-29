# Direct run

Opt-in `/bouncer-run` path for a short serial **full** drive: the user picked
option D at the start ACQ, so this session runs the `coordinate advance` loop
itself instead of dispatching `bouncer-coordinator`. D is offered only when
`bouncer run preflight` reports `direct_eligible: true`. This session never
reads or fixes code, and never implements, reviews, or debugs inline; workers
are always subagents. After the one start ACQ, open no per-task ACQ.

## Procedure

1. Run step 3 (bootstrap) of `SKILL.md`, then from `integrationPath` open
   metrics: `bouncer metrics start --kind root-direct-session --blueprint <dir>
   --label direct`. `ok: false` is reported but never blocks the drive.
2. Call `bouncer coordinate advance --blueprint <dir>` and act on its stop:

   | stop | root action |
   | --- | --- |
   | `worker` (implement) | dispatch the named `bouncer-implementer` per `${BOUNCER_ROOT}/rules/subagent-model.md` (Cursor print: `${BOUNCER_ROOT}/rules/cursor-print-dispatch.md`); require it to read `${BOUNCER_ROOT}/references/coding-standards/index.md` before editing and tell it not to commit (`advance` makes the task commit); then `advance` again |
   | `worker` (`drive_tasks`) | for each task in `task_ids`, call `advance --blueprint <dir> --task <id>`; keep `--task <id>` on each later `advance` until that task is integrated |
   | `judge` dispatch or record | follow the returned card, including its dispatch or record action, then `advance` again |
   | `judge` report-outcome | read the current attempt from the report argv's `--attempt`; process `accepted`, and process `rework` only at attempt 1; hand off other outcomes and later rework |
   | `judge` review-round (including `final_review`) | follow the review-round card; if the reviewer report has no `must_fix` finding (no actionability hint `must_fix`), record the round and `advance` again; if it has one, hand off without recording the round |
   | `yield` | run `coordinate session-open` (`drive-metrics.md` step 1), then `advance` again |
   | `done` | `metrics end`, then `SKILL.md` step 5 |
   | anything else | hand off (below) — record no judgment |

Run `coordinate next` and `advance` from the integration cwd with `--task <ddd>`;
run `report` and `record` from the worker `cwd` that `next` returned.

Before an `accepted` report, check every item against the report file: Brief
revision (`attempt`, `task_brief_hash`) equals the dispatch, Changed files stay
inside the task's scope, Tests shows the assigned verify command passing, the
Interface in the brief matches the changed files, and the task commit that `advance` made (with its `Bouncer-Task` trailer) exists
(HEAD past `integrationHead`, `commit_sha` equal to HEAD's first 8 characters,
no dirty file in scope). The worker never commits, so `advance` owns that commit. Any miss is `rework`, not `accepted`.

Run the returned `report` / `record` argv as is: keep its `--attempt`,
`--task-brief-hash`, lease, generation, and ledger fence, and only add the
judgment arguments. Never generate those values by hand.

```bash
<returned report argv> --outcome accepted --summary "<verify passed, scope kept, commit stamped>"
<returned record argv> --decision "<changed paths from Changed files>: <judgment>"
```

3. Hand off without returning to direct mode for a review round whose reviewer
   report has an actionability hint `must_fix` finding (that round is handed off
   without recording it), attempt 2 or later `rework`, report outcomes
   `scope_revision`, `task_change`, or `blocked`, `critical-recovery`,
   `supplement`, stop reasons `blocked`, `none`, or `max-steps`, any other stop
   kind, and every `ok: false` result (including verify failure from
   `coordinate advance`). The `must_fix` test reads the reviewer report before
   any controller aggregation (severity changes or advisory downgrades); root
   never re-counts severity.

   A `rework` report at attempt 1 continues in direct mode; read the attempt from the `--attempt` value in the report argv.
   Hand off a `rework` report at attempt 2 or later, and any review round whose
   reviewer report has a `must_fix` finding, without recording it.

## Handoff

Do not record the judgment and do not recover by yourself. The ledger gains
only the `session` decision, plus one `review-handoff:` note when the handed-off
round is a review round. From then on the coordinator drives to the end; never
resume direct mode. Run the steps in this order. A failure (`ok: false`) of step
2, 4, 5, or 6 stops the handoff and no later step runs; a metrics failure of step 1
or 3 is reported and the handoff continues. Step 4 is skipped unless the
handed-off round is a review round.

| # | command | cwd | input | after success | on failure |
| --- | --- | --- | --- | --- | --- |
| 1 | `metrics end --id <root-direct id>` (alone, once) | integration | id from `metrics start` | step 2 | report; never blocks the handoff |
| 2 | `coordinate session-open` | integration | `--ledger-path` / `--ledger-hash` of the latest checkpoint | step 3 | stop and report |
| 3 | `metrics start --kind coordinator-session` | integration | `--blueprint <dir>` | step 4 | report; never blocks |
| 4 | `coordinate note --text "<review-handoff text>"` (review round only) | integration | the `checkpoint.ledger` of a `coordinate status` run after step 2, the `review-dispatch` result, and the raw files written below | step 5 | `note-too-long`: retry once with the `unavailable` text below; other `ok: false`: stop and report |
| 5 | `coordinate status --write-input` | integration | none; run after step 4 because the note changes the ledger hash | step 6 | stop and report |
| 6 | coordinator dispatch | integration | the file step 5 wrote | coordinator drives | stop and report |

Raw review files (review round only). Write each reviewer's return body verbatim,
without edits, to `.bouncer/runtime/print/review-handoff-<mode>-<perspective>.md`
in the integration cwd. First run `mkdir -p .bouncer/runtime/print` and delete
every existing `review-handoff-*.md` there. A `review-dispatch` argv with
`--mode delta` sets `<mode>` to `delta`; any other argv sets it to `discovery`.
`<perspective>` is the `perspectives` value assigned to that reviewer (`combined`
for a single or delta review). Compute the sha256 of each written file. Example:
`.bouncer/runtime/print/review-handoff-discovery-spec_scope.md`. If any raw file
cannot be written, delete every raw file of that round and run the note with the
`unavailable` text below instead; the handoff then continues.

Review-handoff note (step 4). Take `checkpoint.ledger` (`path`, `sha256`) from
the `coordinate status` output after `session-open` as the fence. Copy `base`,
`head`, and `snapshot_id` from the `target` of the `review-dispatch` result and
the `perspectives` in that result's order. Write `files=` as one `<path>@<sha256>`
per raw file, with the path relative to the integration cwd, and use only the
form `.bouncer/runtime/print/review-handoff-(discovery|delta)-<perspective>.md`.
The text has this shape:

`review-handoff: mode=<mode>; base=<sha>; head=<sha>; snapshot_id=<id>; perspectives=<p1,p2,…>; files=<path>@<sha256>,…`

The text is at most 2000 characters and is never cut. A longer text gets the
`note-too-long` result; retry once with `review-handoff: unavailable (note-too-long); run discovery`.
A raw-file write failure uses `review-handoff: unavailable (<error summary, first 200 characters>); run discovery`.
The coordinator treats an `unavailable` note as no evidence and runs discovery.

A status input written before `session-open` or the note carries a stale ledger
hash; regenerate it rather than reuse it. See `drive-metrics.md` and `SKILL.md`
step 4.

## Prohibitions

- No code reading, fixing, or direct implementation, review, or debugging.
- No handling of out-of-scope judgments or self-recovery from a stop outside
  the table; those decisions belong to the coordinator.
