# Benchmark scorecard: run-C

**85.59/100 (B)**

Task: `t2` | Config: claude sonnet / autonomous single-shot | Measured-signal confidence: 88%

## Judged (60)

| Dimension | Score | Points | Evidence |
|---|---|---|---|
| Correctness & spec fidelity | 4/5 | 9.6 | scripts/src/lib/verification.ts:75 (and mirrored scripts/lib/verification.js:41) changes VERIFY_COMMAND_FORBIDDEN from /[&\|;`<>\n]\|\$\(/ to /[&\|;`<>\n]\|\$\(\|\$\{\|\$[A-Za-z_]/. Verified by running `node -e` against the exact regex: 'npm test $FLAGS' -> BLOCKED, 'npm test ${FLAGS}' -> BLOCKED (the two reported cases, both fixed). However the predicate `\$[A-Za-z_]` only matches named variables; it still ALLOWS other legitimate shell parameter-expansion forms that are equally environment-dependent under execSync: 'npm test $9' -> ALLOWED, 'npm test $@' -> ALLOWED, 'npm test $*' -> ALLOWED, 'npm test $#' -> ALLOWED, 'npm test $?' -> ALLOWED, 'npm test $$' -> ALLOWED, 'npm test $!' -> ALLOWED, 'npm test $0' -> ALLOWED (all confirmed via direct node invocation of the shipped regex). $$ (PID) and $0 in particular make the executed argv exactly as non-reproducible as $VAR did, which is the stated rationale in the bug report ('execSync로 셸을 통해 실행되므로... 재현 불가능해진다'). The two explicitly named cases are fixed correctly and both surfaces (S12, VERIFY_COMMAND_INVALID) share the one predicate (scripts/src/lib/validate-structural.ts:30-31,580 imports isValidVerifyCommand from verification.ts), so the fix is structurally correct where it goes, but the broader class of shell parameter expansion is only partially closed. |
| Scope discipline | 5/5 | 12.0 | git diff --stat shows exactly 2 files touched: scripts/src/lib/verification.ts and scripts/lib/verification.js (the build artifact), 7 insertions/2 deletions each, i.e. a one-line regex change plus an updated comment in each. No unrelated files, no drive-by refactors. `git status --short` after the diff shows only those two files modified. |
| Test quality | 1/5 | 2.4 | Revert check RAN: `git stash` (removes the two-file diff) then `npm test` -> 696/696 pass; `git stash pop` restores the diff, `npm test` again -> 696/696 pass, identical count. No new test file or test case was added (git diff --stat confirms only verification.ts/js changed, no test/*.js in the diff). Grepped test/verification-runner.test.js and test/skill-verification.test.js for 'FLAGS'/'$VAR'/'isValidVerifyCommand' — no hits; the existing 'readVerifyCommand rejects non-single executable commands' test at test/verification-runner.test.js:236 only covers ['cd sub && npm test', 'npm test \| tee out.log', 'a; b', '  '], none of which exercise $VAR/${VAR}. This is a textbook 'no tests where the project clearly expects them' case: the suite is fully green with the fix reverted, so nothing in the test suite would catch a regression of this exact bug. |
| Codebase fit | 5/5 | 12.0 | The change reuses the existing single shared regex/predicate (isValidVerifyCommand / VERIFY_COMMAND_FORBIDDEN) rather than adding a parallel check; it edits both the TS source and its build artifact in lockstep as the codebase's build convention requires. Verified `npm run build` from the pre-edit compiled js reproduces the committed scripts/lib/verification.js byte-for-byte (`diff` showed no differences), confirming the agent followed (or correctly reproduced) the project's TS->JS build discipline rather than hand-drifting the artifact. |
| Maintainability & clarity | 4/5 | 9.6 | scripts/src/lib/verification.ts:70-73 updates the Korean comment above the regex to explain the new forbidden forms and why (reproducibility under execSync), consistent with the existing comment style in the file. The regex itself, `\$\(\|\$\{\|\$[A-Za-z_]`, is terse but matches the existing single-line-regex idiom already in the file (no new abstraction, no dead code, no debug output). Minor deduction: the comment enumerates only `$(`, backtick, `$VAR`, `${VAR}` and doesn't flag that other $-forms (positional/special params) are intentionally left open, which could mislead a future reader into thinking all `$`-expansion is blocked when it is not. |

**Judged subtotal: 45.6/60**

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

- 2 files (2 source, 0 test), +10/-4
- Test line share: 0.0
- Churn ratio: 1.0 over 0 commits

## Notes

npm test (696/696), npm run typecheck, and npm run lint all pass cleanly on the diff as delivered. Core gap: the fix is correct and complete for the two literally-reported cases ($VAR, ${VAR}) but leaves a same-class hole (special/positional shell parameters: $0 $1..$9 $@ $* $# $? $$ $! $-) that shares the exact reproducibility problem described in the bug report, and it ships with zero regression coverage — reverting the two-line source change leaves the entire 696-test suite green.
