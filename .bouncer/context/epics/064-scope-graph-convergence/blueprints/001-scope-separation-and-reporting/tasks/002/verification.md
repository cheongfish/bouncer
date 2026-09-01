---
type: bouncer.verification
title: 002 verification
description: Verification for 002
resource: .bouncer/context/epics/064-scope-graph-convergence/blueprints/001-scope-separation-and-reporting/tasks/002/verification.md
tags:
  - bouncer
  - verification
timestamp: '2026-09-01T15:49:12.592+09:00'
bouncer:
  id: VERIFY-002
  epic_id: '064'
  blueprint_id: '001'
  status: passed
  verification:
    command: npm test
    ran_at: '2026-09-01T20:50:55.693+09:00'
    exit_code: 0
    output_tail: |-
      ✔ a failing verification keeps the output where a reader will see it (22.779568ms)
      ✔ runVerification prefers tasks.bouncer.verify over config.verify (7.877009ms)
      ✔ runVerification falls back to config.verify when tasks has no verify (7.346544ms)
      ✔ runVerification falls back to config.verify when the task document is absent (6.999531ms)
      ✔ readVerifyCommand rejects non-single executable commands (16.774611ms)
      ✔ readVerifyCommand(repoRoot) still returns config.verify (2.335515ms)
      ✔ readVerifyCommand adopts the earliest-numbered verify declaration (4.163849ms)
      ✔ readVerifyCommand rejects invalid first declaration even if later is valid (4.964258ms)
      ✔ readVerifyCommand narrows to the pointer task document (14.46978ms)
      ✔ runVerification records evidence into the pointer tasks/002 unit only (11.098526ms)
      ✔ runVerification rejects missing unit verification.md without creating it (9.320907ms)
      ℹ tests 976
      ℹ suites 0
      ℹ pass 976
      ℹ fail 0
      ℹ cancelled 0
      ℹ skipped 0
      ℹ todo 0
      ℹ duration_ms 1900.666973
---
# Verification

## Command
`npm test`

## Evidence
Ran at: 2026-09-01T20:50:55.693+09:00
Exit code: 0

## Measured outputs

### `node scripts/bouncer graph-sync`

```json
{
  "ok": true,
  "bootstrap": "ready",
  "action": "skip-fresh",
  "graphs": [
    {
      "name": "source",
      "dirs": [
        "scripts",
        "hooks"
      ],
      "configured": [
        "scripts",
        "hooks"
      ],
      "outDir": "graphify-out/source",
      "action": "skip-fresh",
      "reason": "source graph is up to date",
      "watchFiles": [
        ".bouncer/config.json"
      ],
      "excludeDirs": []
    },
    {
      "name": "test",
      "dirs": [
        "test"
      ],
      "configured": [
        "test"
      ],
      "outDir": "graphify-out/test",
      "action": "skip-fresh",
      "reason": "test graph is up to date"
    },
    {
      "name": "context",
      "dirs": [
        ".bouncer/context"
      ],
      "configured": [
        ".bouncer/context"
      ],
      "outDir": "graphify-out/context",
      "action": "skip-fresh",
      "reason": "context graph is up to date",
      "scanDirs": [
        "graphify-out/context-src"
      ],
      "watchFiles": [
        ".bouncer/Distill.md"
      ]
    }
  ],
  "reason": "graphs are up to date",
  "built": [],
  "failed": [],
  "missing": []
}
```

Confirmations from that JSON: `graphs[name=test].action` is `skip-fresh` (re-run after prior `build`); `graphs[name=source].dirs` is `["scripts","hooks"]` (no `test`).

### `ls graphify-out/test/graph.json`

```
-rw-rw-r-- 1 cheongwoon cheongwoon 803384 Sep  1 20:41 graphify-out/test/graph.json
```

### `node scripts/bouncer graph-suggest --query "session graph scope planning"` (bare; incomplete)

```json
{
  "status": "low-confidence",
  "confidence": "low",
  "candidates": {
    "implementation": [],
    "test": [
      {
        "path": "test/graphify.test.js",
        "score": -12,
        "confidence": "low",
        "basis": [
          "generic name match for graph",
          "test-only without implementation link",
          "test-only without implementation link",
          "contains-only reach"
        ]
      },
      {
        "path": "test/session-graph.test.js",
        "score": -12,
        "confidence": "low",
        "basis": [
          "generic name match for graph",
          "test-only without implementation link",
          "test-only without implementation link",
          "contains-only reach"
        ]
      }
    ],
    "context": []
  },
  "suggested_paths": [],
  "reasons": [
    "context seeds: 0 labels, 0 paths",
    "relation filter: calls, imports, imports_from (depth ≤ 2); contains ownership only",
    "no implementation candidates"
  ]
}
```

Bare checklist query left `candidates.implementation: []` while still placing `test/` under `candidates.test`. Documented `--seed` is required for scripts/ hits.

### `node scripts/bouncer graph-suggest --query "session graph scope planning" --seed scripts/src/lib/session-graph.ts`

```json
{
  "status": "ranked",
  "confidence": "medium",
  "candidates": {
    "implementation": [
      {
        "path": "scripts/check-emit.js",
        "score": 5,
        "confidence": "medium",
        "basis": [
          "calls relation",
          "implementation path"
        ]
      },
      {
        "path": "scripts/lib/comprehension.js",
        "score": 5,
        "confidence": "medium",
        "basis": [
          "calls relation",
          "implementation path"
        ]
      },
      {
        "path": "scripts/lib/graphify.js",
        "score": 5,
        "confidence": "medium",
        "basis": [
          "calls relation",
          "implementation path"
        ]
      },
      {
        "path": "scripts/lib/session-graph.js",
        "score": 5,
        "confidence": "medium",
        "basis": [
          "calls relation",
          "implementation path"
        ]
      },
      {
        "path": "scripts/src/lib/comprehension.ts",
        "score": 5,
        "confidence": "medium",
        "basis": [
          "calls relation",
          "implementation path"
        ]
      },
      {
        "path": "scripts/src/lib/graphify.ts",
        "score": 5,
        "confidence": "medium",
        "basis": [
          "calls relation",
          "implementation path"
        ]
      },
      {
        "path": "scripts/src/lib/session-graph.ts",
        "score": 3,
        "confidence": "low",
        "basis": [
          "path seed scripts/src/lib/session-graph.ts",
          "implementation path"
        ]
      }
    ],
    "test": [
      {
        "path": "test/graphify.test.js",
        "score": -12,
        "confidence": "low",
        "basis": [
          "generic name match for graph",
          "test-only without implementation link",
          "test-only without implementation link",
          "contains-only reach"
        ]
      },
      {
        "path": "test/session-graph.test.js",
        "score": -12,
        "confidence": "low",
        "basis": [
          "generic name match for graph",
          "test-only without implementation link",
          "test-only without implementation link",
          "contains-only reach"
        ]
      }
    ],
    "context": [
      {
        "path": ".bouncer/context/epics/006-scripts-typescript/blueprints/001-tsc-cjs-migrate/tasks/001/tasks.md",
        "score": 4,
        "confidence": "medium",
        "basis": [
          "context graph hit"
        ]
      },
      {
        "path": ".bouncer/context/epics/011-graphify-signal/blueprints/001-silent-skip-signal/tasks/001/tasks.md",
        "score": 4,
        "confidence": "medium",
        "basis": [
          "context graph hit"
        ]
      },
      {
        "path": ".bouncer/context/epics/011-graphify-signal/blueprints/002-graph-path-contract/tasks/001/tasks.md",
        "score": 4,
        "confidence": "medium",
        "basis": [
          "context graph hit"
        ]
      },
      {
        "path": ".bouncer/context/epics/025-graphify-bootstrap/blueprints/001-venv-install-bin-resolution/tasks/001/tasks.md",
        "score": 4,
        "confidence": "medium",
        "basis": [
          "context graph hit"
        ]
      },
      {
        "path": ".bouncer/context/epics/026-context-graph-slim/blueprints/001-context-section-digest/tasks/001/tasks.md",
        "score": 4,
        "confidence": "medium",
        "basis": [
          "context graph hit"
        ]
      },
      {
        "path": ".bouncer/context/epics/035-scripts-refactor/blueprints/001-core-module-split/tasks/001/tasks.md",
        "score": 4,
        "confidence": "medium",
        "basis": [
          "context graph hit"
        ]
      },
      {
        "path": ".bouncer/context/epics/035-scripts-refactor/blueprints/001-core-module-split/tasks/004/tasks.md",
        "score": 4,
        "confidence": "medium",
        "basis": [
          "context graph hit"
        ]
      },
      {
        "path": ".bouncer/context/epics/039-open-source-one-zero/blueprints/001-security-legal-baseline/tasks/006/tasks.md",
        "score": 4,
        "confidence": "medium",
        "basis": [
          "context graph hit"
        ]
      },
      {
        "path": ".bouncer/context/epics/060-graphify-search-quality/blueprints/001-context-first-ranking/tasks/001/tasks.md",
        "score": 4,
        "confidence": "medium",
        "basis": [
          "context graph hit"
        ]
      },
      {
        "path": ".bouncer/context/epics/064-scope-graph-convergence/blueprints/001-scope-separation-and-reporting/tasks/001/tasks.md",
        "score": 4,
        "confidence": "medium",
        "basis": [
          "context graph hit"
        ]
      }
    ]
  },
  "suggested_paths": [
    "scripts/check-emit.js",
    "scripts/lib/comprehension.js",
    "scripts/lib/graphify.js",
    "scripts/lib/session-graph.js",
    "scripts/src/lib/comprehension.ts",
    "scripts/src/lib/graphify.ts"
  ],
  "reasons": [
    "context seeds: 1 labels, 10 paths",
    "relation filter: calls, imports, imports_from (depth ≤ 2); contains ownership only"
  ]
}
```

Delta vs pre-cutover: `test/` no longer monopolizes `candidates.implementation` (those paths sit in `candidates.test`); bare query proves the split with empty implementation, and `--seed scripts/src/lib/session-graph.ts` fills `candidates.implementation` with `scripts/` only.

### `git status --short`

```
 M .bouncer/config.json
 M .bouncer/context/epics/064-scope-graph-convergence/blueprints/001-scope-separation-and-reporting/tasks/002/tasks.md
 M .bouncer/context/epics/064-scope-graph-convergence/blueprints/001-scope-separation-and-reporting/tasks/002/verification.md
```

(`graphify-out/` absent from status — not tracked; `.gitignore` covers `graphify-out/`.)
