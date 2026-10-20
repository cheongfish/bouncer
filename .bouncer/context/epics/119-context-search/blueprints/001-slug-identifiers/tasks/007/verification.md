---
type: bouncer.verification
title: 007 verification
description: Verification for 007
resource: .bouncer/context/epics/119-context-search/blueprints/001-slug-identifiers/tasks/007/verification.md
tags:
  - bouncer
  - verification
timestamp: '2026-10-20T17:07:45.684+09:00'
bouncer:
  id: VERIFY-007
  epic_id: '119'
  blueprint_id: '001'
  status: pending
---
# Verification

## Command
`npm run ci`

## Evidence
Ran at: 2026-10-20T20:09:35.232+09:00
Exit code: 1

```
# Subtest: runVerification → refuses a worker cwd without an active lease
ok 2718 - runVerification → refuses a worker cwd without an active lease
  ---
  duration_ms: 399.697492
  type: 'test'
  ...
# Subtest: runVerification → refuses a worker cwd with an unreadable ledger
ok 2719 - runVerification → refuses a worker cwd with an unreadable ledger
  ---
  duration_ms: 416.573465
  type: 'test'
  ...
# Subtest: runVerification with taskId → uses that task verify command and rejects unknown ids
ok 2720 - runVerification with taskId → uses that task verify command and rejects unknown ids
  ---
  duration_ms: 172.419188
  type: 'test'
  ...
# Subtest: runVerification markTaskVerified → promotes a ready pointer commit task
ok 2721 - runVerification markTaskVerified → promotes a ready pointer commit task
  ---
  duration_ms: 147.702741
  type: 'test'
  ...
# Subtest: runVerification markTaskVerified → promotes a ready leased commit task
ok 2722 - runVerification markTaskVerified → promotes a ready leased commit task
  ---
  duration_ms: 464.009123
  type: 'test'
  ...
# Subtest: runVerification markTaskVerified → leaves status on failure, verified, verification kind, and default
ok 2723 - runVerification markTaskVerified → leaves status on failure, verified, verification kind, and default
  ---
  duration_ms: 326.769864
  type: 'test'
  ...
# Subtest: runVerification markTaskVerified → does not promote a listing-fallback single task
ok 2724 - runVerification markTaskVerified → does not promote a listing-fallback single task
  ---
  duration_ms: 63.28571
  type: 'test'
  ...
# Subtest: runVerification reuse hit with markTaskVerified still → promotes a ready pointer task
ok 2725 - runVerification reuse hit with markTaskVerified still → promotes a ready pointer task
  ---
  duration_ms: 95.326992
  type: 'test'
  ...
# Subtest: readVerifyCommand scoped_terminal → refuses to fall back to config.verify when the task has no command
ok 2726 - readVerifyCommand scoped_terminal → refuses to fall back to config.verify when the task has no command
  ---
  duration_ms: 69.631696
  type: 'test'
  ...
# Subtest: readVerifyCommand scoped_terminal → returns the task-owned command per task and the terminal command without a task id
ok 2727 - readVerifyCommand scoped_terminal → returns the task-owned command per task and the terminal command without a task id
  ---
  duration_ms: 72.662079
  type: 'test'
  ...
# Subtest: readVerifyCommand without a verification_policy marker → keeps the config.verify fallback
ok 2728 - readVerifyCommand without a verification_policy marker → keeps the config.verify fallback
  ---
  duration_ms: 58.256642
  type: 'test'
  ...
# Subtest: terminal npm verification when a direct dependency is missing → rejects before running or reusing and keeps evidence bytes
ok 2729 - terminal npm verification when a direct dependency is missing → rejects before running or reusing and keeps evidence bytes
  ---
  duration_ms: 75.475322
  type: 'test'
  ...
# Subtest: terminal npm verification with all direct dependencies installed and a failing test → records failed evidence
ok 2730 - terminal npm verification with all direct dependencies installed and a failing test → records failed evidence
  ---
  duration_ms: 51.315264
  type: 'test'
  ...
# Subtest: npm verification outside terminal scope or without package.json metadata rules → keeps the current path
ok 2731 - npm verification outside terminal scope or without package.json metadata rules → keeps the current path
  ---
  duration_ms: 73.145599
  type: 'test'
  ...
# Subtest: slug blueprint path → the default task scope key is the slug stable id in the ledger record
ok 2732 - slug blueprint path → the default task scope key is the slug stable id in the ledger record
  ---
  duration_ms: 65.415136
  type: 'test'
  ...
1..2732
# tests 2732
# suites 0
# pass 2731
# fail 1
# cancelled 0
# skipped 0
# todo 0
# duration_ms 66820.158547
```
