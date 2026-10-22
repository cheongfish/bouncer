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
   | `worker` (implement) | dispatch the named `bouncer-implementer` per `${BOUNCER_ROOT}/rules/subagent-model.md` (Cursor print: `${BOUNCER_ROOT}/rules/cursor-print-dispatch.md`); require it to read `${BOUNCER_ROOT}/references/coding-standards/index.md` before editing; then `advance` again |
   | `worker` (`drive_tasks`) | for each task in `task_ids`, call `advance --blueprint <dir> --task <id>`; keep `--task <id>` on each later `advance` until that task is integrated |
   | `judge` dispatch or record | follow the returned card, including its dispatch or record action, then `advance` again |
   | `judge` report-outcome | read the current attempt from the report argv's `--attempt`; process `accepted`, and process `rework` only at attempt 1; hand off other outcomes and later rework |
   | `judge` review-round (including `final_review`) | follow the review-round card and record the round; if that round has no `must_fix`, `advance` again; otherwise hand off |
   | `yield` | run `coordinate session-open` (`drive-metrics.md` step 1), then `advance` again |
   | `done` | `metrics end`, then `SKILL.md` step 5 |
   | anything else | hand off (below) — record no judgment |

Run `coordinate next` and `advance` from the integration cwd with `--task <ddd>`;
run `report` and `record` from the worker `cwd` that `next` returned.

3. Hand off without returning to direct mode for a `must_fix` review round,
   attempt 2 or later `rework`, report outcomes `scope_revision`,
   `task_change`, or `blocked`, `critical-recovery`, `supplement`, stop reasons
   `blocked`, `none`, or `max-steps`, any other stop kind, and every `ok: false`
   result (including verify failure from `coordinate advance`).

   A `rework` report at attempt 1 continues in direct mode; read the attempt from the `--attempt` value in the report argv.
   Hand off a `rework` report at attempt 2 or later and any review round that records a `must_fix`.

## Handoff

Do not record the judgment and do not recover by yourself. Run `metrics end`
for the root-direct session, then follow `SKILL.md` step 4: `coordinate
session-open`, `coordinate status --write-input`, and the coordinator
dispatch. The ledger gains only the `session` decision. From then on the
coordinator drives to the end; never resume direct mode.

## Prohibitions

- No code reading, fixing, or direct implementation, review, or debugging.
- No handling of out-of-scope judgments or self-recovery from a stop outside
  the table; those decisions belong to the coordinator.
