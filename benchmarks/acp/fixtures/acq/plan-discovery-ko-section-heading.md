Starting `/bouncer-plan` for the monthly summary PRD. Loading plugin rules and running preflight.`bouncer` isn't on PATH — locating the CLI and plugin root next.**Preflight:** `.bouncer/` is initialized. `current.status` is `empty` — no blueprint/task/base selected. Suggested next epic id: `001`. Verify signal present: `package.json#scripts`.

**Discovery grounding:** `src/cli.js` only accepts `list|total` with fixed `--file` position; `src/ledger.js` has `loadEntries` / `validateEntries` / `totalCents`; sample data in `data/entries.json` matches the PRD example. All related symbols (`parseArgs`, `loadEntries`, `totalCents`, `validateEntries`, `main`) are `unlinked` — no prior Explain provenance. Epic index is empty.

---

### Discovery handoff

**Goal**  
Ledger CLI에 `summary` 명령을 추가해, 지정한 `YYYY-MM` 월의 지출을 분류별 건수·금액(센트)으로 집계하고 `TOTAL` 행까지 출력한다.

**Scope**
- `node src/cli.js summary --file <path> --month <YYYY-MM>` (옵션 순서 무관)
- 해당 월만 필터 → 분류별 `count` / `amount_cents` 집계 → 분류명 오름차순 → `<category>\t<count>\t<amount_cents>`
- 마지막 줄 `TOTAL\t<count>\t<amount_cents>` (항목 없으면 `TOTAL\t0\t0`)
- `--month`는 실제 달 `YYYY-MM`만 허용; 잘못된/누락 옵션은 stderr + exit 1, stdout 부분 결과 없음
- 기존 `list` / `total` 동작 유지
- 단위 테스트(및 필요 시 CLI 검증) 추가

**Non-goals**
- UI / 다른 기간 집계(주·연) / 통화 변환 / 원장 쓰기·편집
- `list`·`total` 출력 형식 변경
- 의존성 추가

**Success criteria**
1. `node src/cli.js summary --file data/entries.json --month 2026-01` → PRD 예시 stdout과 동일
2. `--month`를 `--file`보다 먼저 넣어도 동일 결과
3. `2026-00` / `2026-13` / `2026-1` 및 옵션 누락 → stderr 오류, exit 1, stdout 비어 있음
4. 해당 월 항목 없음 → stdout이 `TOTAL\t0\t0`만
5. `list` / `total` 기존 동작·출력이 그대로
6. `npm test` 통과

**Edge cases & failure modes**
- 빈 월 / 한 분류만 / 여러 분류(정렬)
- 잘못된 월·누락된 `--file`/`--month`/값 / 알 수 없는 옵션·명령
- 파일 없음·JSON 검증 실패(기존 `loadEntries` 경로)
- 성공 경로에서 stdout에 부분 집계를 남기지 않을 것

**Overlap**  
기존 epic/blueprint 없음. intent는 모두 unlinked. 신규 epic으로 진행.

---

**AskUserQuestion:**

1. **Re-ground**: 위 Goal / Scope / Non-goals / Success criteria / Edge cases / Overlap를 이대로 확정할지
2. **Recommend-why**: PRD와 현재 CLI·ledger 구조에 맞고, 범위가 한 명령 추가에 닫혀 있어 그대로 승인하는 편이 안전함
3. **Options** (recommended-first):
   - A) 이 discovery 프레임으로 진행 (Recommended)
   - B) 수정 후 다시 확인 (수정 내용 적어 주세요)
   - C) 계획 중단

Reply with **A**, **B**, or **C**.