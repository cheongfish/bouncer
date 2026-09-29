Discover confirmed; Full path with epic `001-monthly-summary` / blueprint `001-summary-command`; verify `npm test`. Scaffolding next, then authoring.Authoring epic, blueprint, and task bodies next.문서 초안은 작성해 두었고, `affected_paths`는 아직 비워 두었습니다. Graphify·계약 검사 결과를 바탕으로 범위 확인이 필요합니다.

### graph-suggest (advisory)
- **basis**: source `updated`, test `updated` (`graph-sync` build)
- **query**: `monthly summary category aggregate`
- **seeds**: `src/cli.js`, `src/ledger.js`
- **quality**: `ranked` / confidence `medium` / reasons: `result.ranked`
- **candidates**:
  - implementation: `src/cli.js` (5), `src/ledger.js` (5)
  - test: _(없음)_
- **suggested_paths**: `src/cli.js`, `src/ledger.js`

테스트 후보는 비었지만 Checklist/`npm test`를 초록으로 만들려면 `test/ledger.test.js` 수정이 필요합니다. 엔트리 JSON 스키마는 그대로라 계약 blast는 기존 픽스처 변경을 요구하지 않습니다.

### 제안 `affected_paths` (TASKS-001)
1. `src/cli.js`
2. `src/ledger.js`
3. `test/ledger.test.js`

---

**AskUserQuestion — ACQ affected_paths**

1. **Re-ground**: TASKS-001의 `bouncer.affected_paths`를 위 세 경로로 확정할지
2. **Recommend-why**: Touch·verify(`npm test`)와 일치하고, README/`data`는 Out of scope로 제외함.
3. **Options**:
   - **A)** 위 세 경로로 확정 (Recommended)
   - **B)** 수정 후 확정 (추가·삭제 경로를 적어 주세요)
   - **C)** 취소 / 중단
