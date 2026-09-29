I'll look up the `/bouncer-plan` skill and run its plan gate against this PRD.Loading bouncer master rules and running preflight for the plan gate.No current blueprint/task selection. Starting discovery against the Ledger CLI codebase.Preflight: `.bouncer/` is initialized. **No current selection** (`blueprint` / `task` / `base` are all unset).

Discovery evidence (no provenance to reuse):
- `parseArgs` / `main` in `src/cli.js` only accept `list|total` with fixed `--file` order
- `loadEntries` / `totalCents` / `validateEntries` in `src/ledger.js`; no month/category summary yet
- `bouncer intent`: related symbols are `unlinked` or `unresolved`; no epics under `.bouncer/context/epics/`
- Sample: `data/entries.json` → Jan 2026 = food 1200 + travel 800

---

### Discovery framing (confirm before scaffold)

| Handoff | Draft |
|---|---|
| **Goal** | `summary --file <path> --month <YYYY-MM>`로 해당 월 지출을 분류별 count·합계(센트)로 집계하고, 오름차순 + `TOTAL` 줄을 출력한다. |
| **Scope** | CLI에 `summary` 추가(옵션 순서 무관); 월 필터·분류 집계·탭 구분 출력; `YYYY-MM` 검증 및 오류 시 stderr·exit 1·stdout 무출력; `list`/`total` 유지; 테스트 추가. |
| **Non-goals** | 데이터 스키마/단위 변경; 다른 명령(add/edit 등); 다중 월·통화 포맷; README/문서 필수는 아님. |
| **Success criteria** | (1) 예시 명령이 PRD stdout과 일치 (2) `--month`/`--file` 순서 무관 (3) `2026-00`/`2026-13`/`2026-1`·누락 옵션 → exit 1, stderr, stdout 비움 (4) 해당 월 없음 → `TOTAL\t0\t0` (5) 기존 `list`/`total`·`npm test` 유지 |
| **Edge cases & failure modes** | 빈 월; 잘못된/누락 옵션·월; 같은 분류 다건; 날짜 `YYYY-MM-DD`의 월 prefix 매칭; 파일/JSON 오류는 기존 catch 패턴 |
| **Overlap** | 기존 epic/blueprint 없음. Intent Explain 없음 → 신규 epic+blueprint. `parseArgs` 확장 + ledger 집계 함수 추가가 핵심. |

후보 작업 의존성: 단일 구현 task로 충분해 보임(CLI+ledger+test가 한 단위). Light 선언 시 maintenance epic 아래 blueprint만 생성.

---

**AskUserQuestion — Discover confirm**

1. **Re-ground**: 위 Goal / Scope / Non-goals / Success criteria / Edge cases / Overlap으로 스캐폴드에 들어갈까?
2. **Recommend-why**: PRD가 CLI·출력·검증까지 구체적이라 이 프레이밍이 구현·검증에 바로 쓰임.
3. **Options**:
   - **A)** 위 프레이밍으로 진행 (Recommended)
   - **B)** 수정 후 재확인 (어떤 항목을 바꿀지 적어 주세요)
   - **C)** 취소

---

**AskUserQuestion — Light scope**

1. **Re-ground**: 이 작업을 narrow-scope(light)로 잡을까? Light면 `maintenance` epic 아래 blueprint만, full이면 신규 epic+전체 문서.
2. **Recommend-why**: 소형 fixture에 명령 하나·출력 계약 하나라 light가 문서·게이트 부담이 적음.
3. **Options**:
   - **A)** Light (Recommended) — `maintenance` epic + `--scale light`
   - **B)** Full — 신규 epic + 전체 blueprint/context-review
   - **C)** 취소

---

**AskUserQuestion — ID allocation**

1. **Re-ground**: inspect 제안 id를 쓸까? (`nextEpicId` = `001`; blueprint도 `001`)
2. **Recommend-why**: 빈 저장소라 `001`이 다음 번호이고 충돌이 없음.
3. **Options** (Light면 epic은 maintenance용 다음 `\d{3}`, blueprint `001`):
   - **A)** Suggested ids 사용 — epic `001`(+ slug), blueprint `001` (Recommended)
   - **B)** 다른 id/slug 지정 (예: epic `001-monthly-summary`, bp `001-summary-command`)
   - **C)** 취소

Slug 제안(A 선택 시): epic `monthly-expense-summary` / (light면) `maintenance`; blueprint `summary-command`.

답은 예: `A / A / A` 또는 항목별로 적어 주세요.  
이후 게이트(작성 후): **Verify command** (`npm test` 후보), **affected_paths**, **Approval** — 문서 초안 뒤에 다시 묻습니다.
