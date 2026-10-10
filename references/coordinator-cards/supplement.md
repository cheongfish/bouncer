# supplement

Contract card for the `coordinate next` action `supplement` (blueprint review
mode, after `bouncer coordinate repair --kind supplement` accepted an
in-scope test-evidence gap from the final review).

- `supplement` means one pending decision in the ledger. Dispatch a
  `bouncer-implementer` in `cwd` (the integration worktree) with the finding
  ids and `payload.paths` as its only write boundary. The implementer adds or
  tightens tests only; it commits nothing and flips no document status.
- Classify before you open it, never after. The CLI checks only the path
  conditions (test paths, inside an integrated task's `affected_paths`, no
  delta round yet); a changed test file alone does not make a finding a
  supplement. You declare the finding's nature:
  - `supplement` — an in-scope gap in test evidence that the current product
    behavior already satisfies.
  - `must_fix` repair — a product-behavior defect; use `coordinate repair
    --review-finding` (the existing wave path, two waves at most).
  - `blocked` — a new product decision, dependency, or public interface.
- If the implementer finds a product defect while supplementing, or needs a
  path outside `payload.paths`, stop and report `blocked`. Do not widen the
  paths and do not hide the defect behind a test-only change.
- When the implementer reports done, run `bouncer coordinate repair
  --blueprint <dir> --kind supplement --done --summary <text>
  --ledger-path <checkpoint.ledger.path> --ledger-hash
  <checkpoint.ledger.sha256>`. It confirms the integration changes stay inside
  `payload.paths`, runs the relevant verify command of each integrated task
  that covers those paths once per distinct command, and marks the decision
  `verified`. `supplement-verify-failed` leaves the decision pending: fix and
  retry `--done`, or report `blocked`; do not start a debugger cycle beyond the
  existing one-run ceiling.
- After `verified`, `coordinate next` returns `final_review` with `payload.mode:
  delta`. That is the one delta round the review allows: freeze the same
  `base` and the current integration HEAD, run `review-dispatch` once for
  delta, and do not reopen discovery. The review ceiling (discovery, fix, delta
  once each) and the `must_fix` judgment rule are unchanged.
- A supplement opens no task, no repair wave, and no `terminalFailure`. Once the
  delta round exists, `supplement-delta-used` refuses another one.
