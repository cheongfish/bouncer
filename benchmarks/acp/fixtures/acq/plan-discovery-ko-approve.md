I'll look up the `/bouncer-plan` workflow and run its plan gate against this PRD.Found the bouncer-plan skill — reading it now and following its plan-gate steps.Preflight is clear (no current selection). Next I'll load discovery/ACQ rules and ground the PRD in the repo.**Preflight:** `.bouncer/` is initialized. `current.status` is `empty` — no blueprint/task/base is selected.

**Discover framing** (grounded in `src/cli.js`, `src/ledger.js`, `test/ledger.test.js`, `data/entries.json`; related symbols `parseArgs` / `loadEntries` / `totalCents` / `validateEntries` / `main` are all `unlinked` or `unresolved`; no epics under `.bouncer/context/epics/`):

| Handoff | Draft |
|---|---|
| **Goal** | Ledger CLI에 `summary`를 추가해, 지정한 `YYYY-MM` 월의 지출을 분류별 건수·센트 합계와 `TOTAL`로 출력한다. |
| **Scope** | `summary --file <path> --month <YYYY-MM>` 파싱(옵션 순서 무관); 해당 월 항목만 집계; 분류명 오름차순 `<category>\t<count>\t<amount_cents>` + 마지막 `TOTAL\t…`; `YYYY-MM` 실달 검증; 오류 시 stderr + exit 1·stdout 무출력; `list`/`total` 유지; 필요 시 `ledger` 집계 헬퍼와 테스트. |
| **Non-goals** | 데이터 스키마/금액 단위 변경; 다른 명령 추가; 멀티월·범위 조회; `list`/`total` 출력 형식 변경; UI/영속화. |
| **Success criteria** | 1) 예제 명령이 예시 stdout과 일치 2) `--month`↔`--file` 순서 모두 동작 3) `2026-00`/`2026-13`/`2026-1`·누락·잘못된 옵션은 exit 1·stderr·stdout 비움 4) 해당 월 없으면 `TOTAL\t0\t0` 5) 기존 `list`/`total` 동작·테스트 유지 6) `npm test` 통과 |
| **Edge cases & failure modes** | 빈 월 → `TOTAL\t0\t0`만; 잘못된/누락 옵션·비실달; 파일 로드·검증 실패(기존 `loadEntries`/`validateEntries`); 같은 분류 다건 합산; 다른 월 항목 제외. 오류 문구는 PRD에 고정 문자열이 없음 → 기존 usage 스타일 재사용 가정. |
| **Overlap** | 기존 epic/blueprint 없음. Intent provenance 없음. `parseArgs`/`main` 확장 + 집계 로직(신규 또는 `ledger.js`) + 테스트가 핵심 접점. |

**AskUserQuestion:**

1. **Re-ground**: Discovery 핸드오프(Goal / Scope / Non-goals / Success criteria / Edge cases & failure modes / Overlap)를 이대로 확정할지
2. **Recommend-why**: PRD와 현재 CLI 구조에 맞고, 미지정인 오류 문구만 기존 usage 패턴으로 두는 최소 해석이라 이후 스캐폴드가 바로 진행됨
3. **Options** (recommended-first):
   - A) 위 프레이밍 승인하고 Step 2(ID · Light scope)로 진행 (Recommended)
   - B) 수정 후 재확인 — 바꿀 항목을 적어 주세요 (예: 오류 메시지 고정, 테스트 범위, 집계 위치)
   - C) 중단

Reply with **A**, **B**, or **C** (and edits if B).
