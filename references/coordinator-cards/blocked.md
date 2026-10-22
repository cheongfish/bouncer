# blocked

Contract card for the `coordinate next` action `blocked`. Rules are copied
from the coordinator Procedure step 5 (Judge) and Hard guards.

- When `next` returns `blocked`, take its `reason`, `cause`, and `next` as
  Judge inputs; do not repeat the same `argv` without a judgment.
- Turn each `judge` or `blocked` response, report, reviewer finding, scope
  drift and stalled retry into exactly one of: accepted, scope revision
  (`coordinate revise`), rework with a named cause, task/graph change, or
  terminal blocked. A qualifying delta-certification finding takes the
  critical recovery before that rework (result: `resolved` or `blocked`).
  Every judgment gets a ledger entry via the fenced mutation that records it;
  ordinary rework follows the no-progress rule.

## Critical recovery

- A delta-certification `blocker` or `major` (`introduced_by_revision` or
  `missed_critical`) proving a false-acceptance risk may open a critical
  recovery with `bouncer coordinate critical-recovery` that keeps task intent
  and needs no new product decision, dependency, or public interface. Record
  its findings and reason with `coordinate critical-recovery` before dispatch,
  then record `resolved` or `blocked` afterward. The task has exactly one such
  recovery: a remaining same finding or any new `blocker` or `major` is
  terminal `blocked`, never another dispatch.

## Terminal CI repair

- If a terminal failure was caused by the environment only and no code has to
  change, first run `bouncer coordinate reverify --task <terminal>`. It re-runs
  the terminal verification without a repair wave and is refused with
  `reverify-source-moved` or `reverify-worktree-dirty` when the source changed.
  When the code has to change, use `repair`.
- Terminal CI recovery runs through `bouncer coordinate repair`: supply the
  failing command, its summary, and why the repair stays inside the Blueprint.
  Its refusal is final; never start another wave by hand. Terminal CI failure
  may add at most two dynamic repair tasks. After a second repair still fails,
  automatic execution stops.
- Repair `--paths` come from tracked files named in the failure evidence or
  debugger report; a file to create goes in `--new-path` under a tracked
  directory. On `scoped_terminal` pass `--verify <argv>` that checks only the
  failing files. A refusal (`scope-path-untracked`,
  `scope-new-path-parent-missing`, `repair-verify-required`,
  `repair-verify-not-single-argv`, `repair-verify-is-terminal`) changes
  nothing: correct the input and retry.
- Before adding a task, classify the cause. Code owned by an integrated task is
  reworked on that task: `coordinate repair --task <terminal> --resume-task
  <ddd>` (no new task, DAG and scope unchanged, new lease generation). A cause,
  failing test, and needed change proven outside every approved scope is
  recorded with `--disposition outside_scope` against the original evidence;
  the failure stays failed and `next` moves on. The options are mutually
  exclusive, and an unclear, mixed, or stale cause stays `blocked`.
- When the CLI refuses another repair wave (after a second repair still
  fails), preserve the integration and worker worktrees and the last failure,
  create untracked integration-root `NEXT_PLAN.md`, and stop for user
  confirmation. Only `coordinate partial-close --user-confirmed` may set
  `partial_closed`; it is unresolved handoff, never ordinary success or
  `closed`, and none of those preserved artifacts may be copied to main,
  committed, pushed, or included in a PR.

## Stopping points

- Never answer another workflow's consent step on the user's behalf — reaching
  one is a stopping point, not a question you get to ask. Stop and report the
  same way when a blocker needs a destructive repo action, an external
  credential, or a host permission you do not hold.
