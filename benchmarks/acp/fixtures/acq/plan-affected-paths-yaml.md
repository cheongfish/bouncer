Setting `bouncer.verify`, then asking you to confirm `affected_paths`.`bouncer.verify: npm test` set on TASKS-001. No source graph (`graphify-out` 없음) — graph-suggest skipped.

**Minimality (advisory):** Touch is three files (CLI entry, ledger aggregation, tests). No new deps/abstractions. README/`data/entries.json` stay out.

**Contract blast:** Entry JSON shape unchanged; no other fixtures assert an old summary contract.

---

**AskUserQuestion (ACQ — affected_paths):**

1. **Re-ground**: Confirm TASKS-001 `bouncer.affected_paths` (must be non-empty; only user-confirmed values are written).
2. **Recommend-why**: Matches Touch exactly — CLI wiring, month/category aggregation, and tests needed for `npm test` green.

### Proposed paths
```yaml
affected_paths:
  - src/cli.js
  - src/ledger.js
  - test/ledger.test.js
```

### Options
- **A)** 위 목록 그대로 확정 (Recommended)
- **B)** 수정안 제시 (추가/삭제 경로를 적어 주세요)
- **C)** 취소 — plan 중단

`A` / `B` / `C`로 답해 주세요.
