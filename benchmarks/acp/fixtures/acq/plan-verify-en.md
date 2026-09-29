Scaffolding the full epic and blueprint, then loading authoring rules.Authoring epic, blueprint, and task bodies next.Draft authored for epic `001-monthly-summary`, blueprint `001-summary-command`, task `TASKS-001` (full scale). Graph-suggest (advisory):

| Role | Paths | Notes |
| --- | --- | --- |
| implementation | `src/cli.js`, `src/ledger.js` | confidence medium |
| test | _(none)_ | — |
| suggested_paths | `src/cli.js`, `src/ledger.js` | Touch also names `test/ledger.test.js`, `README.md` |

**basis:** source `updated` · test `updated` · query `monthly summary category aggregation`

---

**AskUserQuestion (Verify command):**

1. **Re-ground**: `package.json#scripts`가 있어 이 블루프린트 task에 `bouncer.verify`를 둘지
2. **Recommend-why**: 수용 기준이 단위·CLI 회귀라 저장소 기본과 같은 `npm test` 한 argv면 재현 가능함
3. **Options**:
   - A) Set `bouncer.verify: npm test` on `TASKS-001` (Recommended)
   - B) Set a different single argv — reply with the exact command (no `&&`, pipes, `cd`)
   - C) Leave unset — execute uses global `config.verify` (`npm test`)
   - D) Cancel

Reply **A**, **B** (+ command), **C**, or **D**.
