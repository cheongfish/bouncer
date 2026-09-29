I'll look up the `/bouncer-plan` skill and run its plan gate against this PRD.Found the bouncer-plan skill — reading it and following its plan-gate steps.Preflight shows no current selection. Next I'll ground discovery in the repo and load the discovery skill.**Preflight:** `current.status` is `empty` — no blueprint/task/base is selected.

**Intent:** `parseArgs`, `loadEntries`, `totalCents`, `validateEntries` are all `unlinked` (no provenance). No existing epics under `.bouncer/context/epics/`.

---

### Discovery framing (confirm before scaffold)

| Handoff | Draft |
|---|---|
| **Goal** | Ledger CLI에 `summary` 명령을 추가해, 지정한 `YYYY-MM` 월의 지출을 분류별 건수·금액(센트)으로 집계·출력한다. |
| **Scope** | `summary --file <path> --month <YYYY-MM>` 파싱(옵션 순서 무관); 해당 월 필터·분류별 count/amount 집계·분류명 오름차순 출력; `TOTAL` 행; `--month` 실달 검증; 오류 시 stderr + exit 1·stdout 부분 결과 없음; `list`/`total` 동작 유지; 관련 테스트 추가. |
| **Non-goals** | `list`/`total` 포맷 변경; 스키마·금액 단위 변경; 기간 범위(다중 월)·통화 포맷; README 외 문서/프로덕트 확장. |
| **Success criteria** | `summary --file data/entries.json --month 2026-01` → 예시와 동일 stdout; 해당 월 없음 → `TOTAL\t0\t0`; 잘못된/누락 옵션·유효하지 않은 월 → stderr + exit 1·stdout 비움; 기존 `list`/`total`·`npm test` 통과. |
| **Edge cases & failure modes** | `--file`/`--month` 누락·값 없음; `2026-00`/`2026-13`/`2026-1` 거부; 빈 월; 옵션 순서 교체; 분류 오름차순; 기존 파일/JSON/엔트리 검증 오류는 현행 유지. |
| **Overlap** | 기존 epic/blueprint 없음. 심볼 provenance 없음. `src/cli.js` `parseArgs`/`main` 확장 + (필요 시) `src/ledger.js` 집계 헬퍼 + `test/` 가 주 변경 축. |

---

**AskUserQuestion:**

1. **Re-ground**: Discovery 핸드오프(Goal / Scope / Non-goals / Success criteria / Edge cases & failure modes / Overlap)를 이대로 확정할지
2. **Recommend-why**: PRD와 현재 `list`/`total` CLI 구조에 맞춰 범위가 이미 구체적이라, 이 초안으로 확정하고 스캐폴드로 넘어가는 편이 빠름
3. **Options** (recommended-first):
   - A) Confirm discovery as drafted (Recommended)
   - B) Revise — reply with which handoff fields to change
   - C) Cancel `/bouncer-plan`
