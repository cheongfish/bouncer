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
   | `worker` (review) | dispatch the named `bouncer-reviewer` the same way; then `advance` again |
   | `judge` | judge by the returned card; run the card's argv only when the result is accepted (normal dispatch, review passed, report accepted, record) |
   | `yield` | run `coordinate session-open` (`drive-metrics.md` step 1), then `advance` again |
   | `done` | `metrics end`, then `SKILL.md` step 5 |
   | anything else | hand off (below) — record no judgment |

3. "Anything else" is every result outside the four rows above that continue
   or finish the drive. It includes a judgment that is not accepted (rework,
   scope_revision, task_change, blocked), a `must_fix` from `revise`,
   `critical-recovery`, `supplement`, or `final_review`, the `blocked`, `none`,
   and `max-steps` stops, a `worker` stop that is not implement or review, and
   every `ok: false` result (`repeated-failure`, `unclear-result`,
   `advance-argv-invalid`, or an automatic action's failure).

## Handoff

Do not record the judgment and do not recover by yourself. Run `metrics end`
for the root-direct session, then follow `SKILL.md` step 4: `coordinate
session-open`, `coordinate status --write-input`, and the coordinator
dispatch. The ledger gains only the `session` decision. From then on the
coordinator drives to the end; never resume direct mode.

## Prohibitions

- No code reading, fixing, or direct implementation, review, or debugging.
- No recording of a non-accepted judgment, and no self-recovery from a stop
  outside the table.
