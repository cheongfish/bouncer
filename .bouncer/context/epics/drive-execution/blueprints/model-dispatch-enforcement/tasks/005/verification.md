---
type: bouncer.verification
title: 005 verification
description: Verification for 005
resource: .bouncer/context/epics/drive-execution/blueprints/model-dispatch-enforcement/tasks/005/verification.md
tags:
  - bouncer
  - verification
timestamp: '2026-10-26T14:23:38.463+09:00'
bouncer:
  id: VERIFY-005
  epic_id: drive-execution
  blueprint_id: model-dispatch-enforcement
  status: failed
  verification:
    command: npm run ci
    ran_at: '2026-10-26T15:35:06.242+09:00'
    exit_code: 1
    output_tail: |-
      # Subtest: scripts resolveSpawn on win32 with npx → runs npx-cli.js through node
      ok 3164 - scripts resolveSpawn on win32 with npx → runs npx-cli.js through node
        ---
        duration_ms: 0.639481
        type: 'test'
        ...
      # Subtest: scripts resolveSpawn on win32 with npm_execpath → prefers that npm-cli.js
      ok 3165 - scripts resolveSpawn on win32 with npm_execpath → prefers that npm-cli.js
        ---
        duration_ms: 2.923792
        type: 'test'
        ...
      # Subtest: scripts resolveSpawn on win32 without npm-cli.js → falls back to npm.cmd through a shell
      ok 3166 - scripts resolveSpawn on win32 without npm-cli.js → falls back to npm.cmd through a shell
        ---
        duration_ms: 0.449349
        type: 'test'
        ...
      # Subtest: scripts resolveSpawn on win32 with another executable → leaves it unchanged
      ok 3167 - scripts resolveSpawn on win32 with another executable → leaves it unchanged
        ---
        duration_ms: 0.617615
        type: 'test'
        ...
      # Subtest: scripts resolveSpawn on linux with npm → leaves it unchanged
      ok 3168 - scripts resolveSpawn on linux with npm → leaves it unchanged
        ---
        duration_ms: 0.223813
        type: 'test'
        ...
      # Subtest: runtime resolveSpawn on win32 with npm → runs npm-cli.js through node without a shell
      ok 3169 - runtime resolveSpawn on win32 with npm → runs npm-cli.js through node without a shell
        ---
        duration_ms: 0.481363
        type: 'test'
        ...
      # Subtest: runtime resolveSpawn on win32 with npx → runs npx-cli.js through node
      ok 3170 - runtime resolveSpawn on win32 with npx → runs npx-cli.js through node
        ---
        duration_ms: 0.181686
        type: 'test'
        ...
      # Subtest: runtime resolveSpawn on win32 with npm_execpath → prefers that npm-cli.js
      ok 3171 - runtime resolveSpawn on win32 with npm_execpath → prefers that npm-cli.js
        ---
        duration_ms: 0.724314
        type: 'test'
        ...
      # Subtest: runtime resolveSpawn on win32 without npm-cli.js → falls back to npm.cmd through a shell
      ok 3172 - runtime resolveSpawn on win32 without npm-cli.js → falls back to npm.cmd through a shell
        ---
        duration_ms: 0.768904
        type: 'test'
        ...
      # Subtest: runtime resolveSpawn on win32 with another executable → leaves it unchanged
      ok 3173 - runtime resolveSpawn on win32 with another executable → leaves it unchanged
        ---
        duration_ms: 0.437108
        type: 'test'
        ...
      # Subtest: runtime resolveSpawn on linux with npm → leaves it unchanged
      ok 3174 - runtime resolveSpawn on linux with npm → leaves it unchanged
        ---
        duration_ms: 0.119814
        type: 'test'
        ...
      # Subtest: responsibility runtime graph → has no cycles or forbidden reverse dependencies
      ok 3175 - responsibility runtime graph → has no cycles or forbidden reverse dependencies
        ---
        duration_ms: 2.91285
        type: 'test'
        ...
      # Subtest: each forbidden fixture edge → identifies its source and destination
      ok 3176 - each forbidden fixture edge → identifies its source and destination
        ---
        duration_ms: 7.456175
        type: 'test'
        ...
      # Subtest: pure modules and type-only contracts → contain no I/O builtin imports
      ok 3177 - pure modules and type-only contracts → contain no I/O builtin imports
        ---
        duration_ms: 9.337348
        type: 'test'
        ...
      # Subtest: builtin imports in AST fixtures → detect type imports, require and dynamic import only
      ok 3178 - builtin imports in AST fixtures → detect type imports, require and dynamic import only
        ---
        duration_ms: 1.192832
        type: 'test'
        ...
      1..3178
      # tests 3178
      # suites 0
      # pass 3177
      # fail 1
      # cancelled 0
      # skipped 0
      # todo 0
      # duration_ms 100474.752271
    evidence_id: a03257213d8ae9623ce9768dee83655dcf3a8c0d89962efdf95d621428d29cd4
    identity:
      head: 320d92d234d561c9a5eff85842dbbe93a4df489f
      dirty_digest: e30b0068a68d368763329a4a1e76e4cce60558713c2f26a55c667a1541d6eabd
      command: npm run ci
      cwd: .
      environment_hash: 049b400e826c2a844c3428cc1aa338a2ad61e931014db60a958ebf8530530011
      scope: &ref_0
        kind: terminal
        key: drive-execution/model-dispatch-enforcement:320d92d234d561c9a5eff85842dbbe93a4df489f
    scope: *ref_0
    reused: false
    source_digest: 4f53cda18c2baa0c0354bb5f9a3ecbe5ed12ab4d8e11ba873c2f11161202b945
---
# Verification

## Command
`npm run ci`

## Evidence
Ran at: 2026-10-26T15:35:06.242+09:00
Exit code: 1

```
# Subtest: scripts resolveSpawn on win32 with npx → runs npx-cli.js through node
ok 3164 - scripts resolveSpawn on win32 with npx → runs npx-cli.js through node
  ---
  duration_ms: 0.639481
  type: 'test'
  ...
# Subtest: scripts resolveSpawn on win32 with npm_execpath → prefers that npm-cli.js
ok 3165 - scripts resolveSpawn on win32 with npm_execpath → prefers that npm-cli.js
  ---
  duration_ms: 2.923792
  type: 'test'
  ...
# Subtest: scripts resolveSpawn on win32 without npm-cli.js → falls back to npm.cmd through a shell
ok 3166 - scripts resolveSpawn on win32 without npm-cli.js → falls back to npm.cmd through a shell
  ---
  duration_ms: 0.449349
  type: 'test'
  ...
# Subtest: scripts resolveSpawn on win32 with another executable → leaves it unchanged
ok 3167 - scripts resolveSpawn on win32 with another executable → leaves it unchanged
  ---
  duration_ms: 0.617615
  type: 'test'
  ...
# Subtest: scripts resolveSpawn on linux with npm → leaves it unchanged
ok 3168 - scripts resolveSpawn on linux with npm → leaves it unchanged
  ---
  duration_ms: 0.223813
  type: 'test'
  ...
# Subtest: runtime resolveSpawn on win32 with npm → runs npm-cli.js through node without a shell
ok 3169 - runtime resolveSpawn on win32 with npm → runs npm-cli.js through node without a shell
  ---
  duration_ms: 0.481363
  type: 'test'
  ...
# Subtest: runtime resolveSpawn on win32 with npx → runs npx-cli.js through node
ok 3170 - runtime resolveSpawn on win32 with npx → runs npx-cli.js through node
  ---
  duration_ms: 0.181686
  type: 'test'
  ...
# Subtest: runtime resolveSpawn on win32 with npm_execpath → prefers that npm-cli.js
ok 3171 - runtime resolveSpawn on win32 with npm_execpath → prefers that npm-cli.js
  ---
  duration_ms: 0.724314
  type: 'test'
  ...
# Subtest: runtime resolveSpawn on win32 without npm-cli.js → falls back to npm.cmd through a shell
ok 3172 - runtime resolveSpawn on win32 without npm-cli.js → falls back to npm.cmd through a shell
  ---
  duration_ms: 0.768904
  type: 'test'
  ...
# Subtest: runtime resolveSpawn on win32 with another executable → leaves it unchanged
ok 3173 - runtime resolveSpawn on win32 with another executable → leaves it unchanged
  ---
  duration_ms: 0.437108
  type: 'test'
  ...
# Subtest: runtime resolveSpawn on linux with npm → leaves it unchanged
ok 3174 - runtime resolveSpawn on linux with npm → leaves it unchanged
  ---
  duration_ms: 0.119814
  type: 'test'
  ...
# Subtest: responsibility runtime graph → has no cycles or forbidden reverse dependencies
ok 3175 - responsibility runtime graph → has no cycles or forbidden reverse dependencies
  ---
  duration_ms: 2.91285
  type: 'test'
  ...
# Subtest: each forbidden fixture edge → identifies its source and destination
ok 3176 - each forbidden fixture edge → identifies its source and destination
  ---
  duration_ms: 7.456175
  type: 'test'
  ...
# Subtest: pure modules and type-only contracts → contain no I/O builtin imports
ok 3177 - pure modules and type-only contracts → contain no I/O builtin imports
  ---
  duration_ms: 9.337348
  type: 'test'
  ...
# Subtest: builtin imports in AST fixtures → detect type imports, require and dynamic import only
ok 3178 - builtin imports in AST fixtures → detect type imports, require and dynamic import only
  ---
  duration_ms: 1.192832
  type: 'test'
  ...
1..3178
# tests 3178
# suites 0
# pass 3177
# fail 1
# cancelled 0
# skipped 0
# todo 0
# duration_ms 100474.752271
```
