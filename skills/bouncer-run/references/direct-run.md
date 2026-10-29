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
   | `judge` review-round (including `final_review`) | follow the review-round card and record the round; if that round has no `must_fix`, `advance` again; otherwise hand off |
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

3. Hand off without returning to direct mode for a `must_fix` review round,
   attempt 2 or later `rework`, report outcomes `scope_revision`,
   `task_change`, or `blocked`, `critical-recovery`, `supplement`, stop reasons
   `blocked`, `none`, or `max-steps`, any other stop kind, and every `ok: false`
   result (including verify failure from `coordinate advance`).

   A `rework` report at attempt 1 continues in direct mode; read the attempt from the `--attempt` value in the report argv.
   Hand off a `rework` report at attempt 2 or later and any review round that records a `must_fix`.

## Handoff

Do not record the judgment and do not recover by yourself. The ledger gains
only the `session` decision. From then on the coordinator drives to the end;
never resume direct mode. Run the steps in this order. A failure (`ok: false`)
of step 2, 4, or 5 stops the handoff and no later step runs; a metrics failure of
step 1 or 3 is reported and the handoff continues.

| # | command | cwd | input | after success | on failure |
| --- | --- | --- | --- | --- | --- |
| 1 | `metrics end --id <root-direct id>` (alone, once) | integration | id from `metrics start` | step 2 | report; never blocks the handoff |
| 2 | `coordinate session-open` | integration | `--ledger-path` / `--ledger-hash` of the latest checkpoint | step 3 | stop and report |
| 3 | `metrics start --kind coordinator-session` | integration | `--blueprint <dir>` | step 4 | report; never blocks |
| 4 | `coordinate status --write-input` | integration | none; run after step 2 because `session-open` changes the ledger hash | step 5 | stop and report |
| 5 | coordinator dispatch | integration | the file step 4 wrote | coordinator drives | stop and report |

A status input written before `session-open` carries a stale ledger hash;
regenerate it rather than reuse it. See `drive-metrics.md` and `SKILL.md`
step 4.

## Prohibitions

- No code reading, fixing, or direct implementation, review, or debugging.
- No handling of out-of-scope judgments or self-recovery from a stop outside
  the table; those decisions belong to the coordinator.
