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

- Terminal CI recovery runs through `bouncer coordinate repair`: supply the
  failing command, its summary, and why the repair stays inside the Blueprint.
  Its refusal is final; never start another wave by hand. Terminal CI failure
  may add at most two dynamic repair tasks. After a second repair still fails,
  automatic execution stops.
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
