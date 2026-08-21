# Benchmark scorecard: run-E

**95.19/100 (A)**

Task: `t3` | Config: claude sonnet / autonomous single-shot | Measured-signal confidence: 88%

## Judged (60)

| Dimension | Score | Points | Evidence |
|---|---|---|---|
| Correctness & spec fidelity | 5/5 | 12.0 | Manual behavioral diff swapping scripts/lib/cli-current-command.js between base (git show 3f52018:...) and agent build across 7 arg combinations (current; --clear; --set; --set --clear; --task 002; --set --task 002; --set nonexistent) showed byte-identical stdout, stderr, and exit codes in every case (script output: 'MATCH' for all 7). npm test: 696/696 pass. `npm run build` output is byte-identical to the committed scripts/lib/cli-current-command.js (verified via `diff`). No input found where behavior differs from base. |
| Scope discipline | 5/5 | 12.0 | `git diff --stat 3f52018` touches exactly 2 files: scripts/src/lib/cli-current-command.ts (the requested TS source) and its build artifact scripts/lib/cli-current-command.js (unavoidable, matches `npm run build` output exactly). All 5 io.out(JSON.stringify(...)) call sites (lines 82, 96, 140, 149, 152 in the original) were replaced with calls to a single new `emitJson(io, payload)` helper added right after the CliIo type (ts:46-48). No renames, no reformatting, no unrelated edits. |
| Test quality | 3/5 | 7.2 | No new tests added (git diff --stat shows no test/ changes). Existing test/cli-current.test.js (13 tests) exercises all 5 call sites (clear, set-success, set-failure, task variants, bare-with-pointer, bare-without-pointer) and all pass. However, mutation check: replacing emitJson's body with `io.out(JSON.stringify(payload))` (dropping the 2-space indent and trailing newline) and re-running test/cli-current.test.js still yields 13/13 pass, because every assertion goes through `JSON.parse(r.out)` rather than checking raw string/whitespace. So the existing suite would not catch a serialization-format regression in the exact invariant the task cared about (identical output bytes) — only my manual raw-byte diff against base caught that. Coverage of branches is good; coverage of the specific 'byte-identical' requirement is not locked in by any test. |
| Codebase fit | 5/5 | 12.0 | emitJson(io: CliIo, payload: unknown) sits directly below the existing CliIo type (ts:41-48), uses the same `io.out` call convention already used throughout the file, and payload is typed `unknown` consistent with the file's existing style of loosely-typed require() casts. No new dependency, no new pattern; a reviewer would not distinguish it from originally-authored code. |
| Maintainability & clarity | 5/5 | 12.0 | Single 3-line helper (ts:46-48), clear name, no dead code, no leftover comments/TODOs, existing Korean inline comments at each call site preserved unchanged. Diff is minimal and easy to review in one glance (14 lines changed in the .ts file). |

**Judged subtotal: 55.2/60**

## Measured (40)

| Signal | Ratio | Points |
|---|---|---|
| tests_pass | 1.0 | 17.14/17.14 |
| static_clean | 1.0 | 11.43/11.43 |
| build_ok | 1.0 | 5.71/5.71 |
| efficiency | 1.0 | 5.71/5.71 |

**Measured subtotal: 39.99/40**

> Only 88% of the measured scale had real signal; the rest was renormalized across available checks. Compare against runs with the same checks.

## Change shape

- 2 files (2 source, 0 test), +17/-10
- Test line share: 0.0
- Churn ratio: 1.0 over 0 commits

## Notes

Verified build reproducibility: `npm run build` from the committed .ts source reproduces the committed scripts/lib/cli-current-command.js byte-for-byte. Behavioral identity verified by swapping the compiled JS between base commit (3f52018) and the agent's version and diffing stdout/stderr/exit code across 7 flag combinations including the mutually-exclusive error paths (--set --clear, --task without --set) — all matched exactly. lint and typecheck are clean. The only soft gap is dimension 3: the task's core invariant (byte-identical JSON output) is not directly asserted by any test in the repo, pre-existing or added; this was only confirmed via my own manual diffing, not by the test suite.
