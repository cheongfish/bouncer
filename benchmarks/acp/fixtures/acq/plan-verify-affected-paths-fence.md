Discover / Full / IDs confirmed. Scaffolding epic `001` and blueprint `001`, then authoring the plan docs.Scaffolding done. Authoring epic, blueprint, and task bodies next.Drafts are authored. Graphify ranked `src/cli.js` and `src/ledger.js` (medium); tests/README were not suggested — confirm those manually from Touch.

**Task DAG (TASKS-001):** `depends_on: []` · `parallel_safe: false` · `dependency_gate: integrated` · `execution_kind: commit` · `review_risk: [public_interface]` — no peer conflicts.

---

**AskUserQuestion — Verify command**

1. **Re-ground**: task `bouncer.verify`를 `npm test`로 둘지 (`package.json#scripts` 감지; 거부 시 global `config.verify` 유지)
2. **Recommend-why**: 이미 `config.verify`가 `npm test`이고 수용 기준 7과 동일함
3. **Options**:
   - **A)** `bouncer.verify: npm test` 설정 (Recommended)
   - **B)** 다른 단일 argv (예: `node --test test/cli.test.js`) — 값을 적어 주세요
   - **C)** 설정 안 함 (global `config.verify` 사용)
   - **D)** 중단

---

**AskUserQuestion — affected_paths (TASKS-001)**

1. **Re-ground**: 승인할 변경 경로 집합 (G5 non-empty; Touch와 일치해야 함)
2. **Recommend-why**: graph-suggest는 `src/cli.js`·`src/ledger.js`만 줌. PRD·Discover(A)대로 집계 테스트·CLI 스폰 테스트·README가 Checklist/`npm test`에 필요함
3. **제안 목록**:
   ```
   src/cli.js
   src/ledger.js
   test/ledger.test.js
   test/cli.test.js
   README.md
   ```
4. **Options**:
   - **A)** 위 5경로 그대로 승인 (Recommended)
   - **B)** 수정안 제시 (추가/삭제 경로를 적어 주세요)
   - **C)** 중단

답 예: `Verify: A` / `Paths: A`
