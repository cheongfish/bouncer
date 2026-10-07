# review

Contract card for the `coordinate next` action `review` (per-task review,
when `review_scope` is absent). Rules are copied from the coordinator Worker
dispatch and the execute agent-dispatch and review-round references.

- Dispatch named `bouncer-reviewer` through `rules/subagent-model.md`.
  `bouncer-reviewer` stays read-only. Never play that role yourself and never
  let one worker judge another's report.
- When `review_scope` is absent, keep the existing per-task procedure: freeze
  base/head first, then run `bouncer review-dispatch execute --blueprint <dir>
  --task <NNN> --base <sha> --head <sha>`. On `ok: false`, a frozen
  base/head/task mismatch, or `risk_flags` disagreeing with that task's
  `review_risk`, stop — do not open a review round and do not record
  `accepted`. Walk `perspectives` in CLI order.
- For review, freeze the target first (base, HEAD, task-brief revision,
  `task_brief_hash`, `intent_bundle_id`, `intent_bundle_revision`, and latest
  verify). Use that CLI JSON's `strategy`, `perspectives` order, and
  `risk_flags` as the only discovery dispatch choice — do not recompute
  file/line stats, guess risk from path names or diff bodies, or override the
  returned list.
- Dispatch discovery reviewers by walking the CLI `perspectives` array in order
  — that list is the only fan-out. Do not also branch on `strategy` to invent
  calls, and do not append `security` from `risk_flags` separately; the CLI
  already placed those choices in `perspectives` (for example `single` without
  risk → `combined`; small risk → `combined` then `security`; `parallel`
  without risk → the three non-security perspectives; large risk → those three
  then `security`). Named, generic fallback, and inline paths all walk that
  same `perspectives` sequence — never a different fan-out per host. Each
  discovery prompt contains only its assigned perspective, the six brief
  sections, the reviewer's `intent_sections` projection from `bouncer intent
  sections --task <current.task.path> --role reviewer`, the frozen target
  (including the shared bundle identifiers), `strategy`, and `risk_flags`, and
  never another reviewer's findings or the full Explain body.
- If named agents are unavailable, dispatch fresh generic subagents in the
  same `perspectives` order, each carrying the entire body of
  `agents/bouncer-reviewer.md` — every section from Authority through Output
  contract, verbatim — plus its filled reviewer-prompt: frozen base and HEAD,
  task brief revision, `task_brief_hash`, `intent_bundle_id`,
  `intent_bundle_revision`, `intent_sections`, mode, perspective, strategy,
  risk_flags, latest verify, and for delta the previous findings and revision
  diff, with the read-only cwd.

## Round

- The normal ceiling is **discovery wave 1회, fix batch 1회, delta
  certification 1회**. Preserve the ceilings the dispatched workflow owns
  (discovery 1, fix 1, delta 1, drive critical recovery 1), and record in the
  ledger which worker produced each result.
- Aggregate: verify evidence, merge duplicate fingerprints, record
  severity_changes and origin, then decide must_fix or advisory from the
  brief, evidence, and changed range — never a reviewer vote.
- Fix, under a coordinator drive on the per-task path: judge the prior
  implementer report (`coordinate report`), revise only when the outcome
  requires it, then open a new `coordinate dispatch` so the fix implementer
  receives the increased attempt, task_brief_hash, base_head,
  initial_worktree_state, and previous_outcome.
- After one aggregate and one fix batch, dispatch exactly one delta reviewer
  with previous findings and the revision diff — delta does not receive a
  discovery perspective. Fail-closed compares against that round's frozen
  target. Never repeat full discovery after delta certification or split
  findings into separate implementer dispatches.
- Do not edit `review.md` YAML by hand. Record every state transition with
  `bouncer review record --blueprint <dir> --task <NNN> --round <json-file>
  [--status <requested|addressed|accepted>]` into `bouncer.review.rounds[]`
  and `bouncer.review.findings[]`. On `{ ok: false }`, follow `reason` /
  `next`; do not recover by editing frontmatter or reading validator sources.
- All must_fix resolved and verify passed: accepted. Conflicting findings, or
  a new design, dependency, public Interface, or scope requirement, is
  `blocked`; under a drive, hand the coordinator the open findings to
  disposition.
