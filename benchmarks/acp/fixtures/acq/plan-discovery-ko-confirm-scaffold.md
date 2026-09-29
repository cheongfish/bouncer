I'll look up the `/bouncer-plan` skill and follow its plan-gate process for this PRD.Found the bouncer plugin. Reading the `bouncer-plan` skill next.Loading plugin rules and running preflight inspect.No selection is active. Grounding discovery in the repo next, then I'll ask for the Discover confirm.Running `bouncer intent` on the related CLI/ledger symbols.**Preflight:** `current.status` is `empty` — no blueprint/task/base is selected.

**Discover framing** (from the PRD + current CLI/ledger code; related symbols `parseArgs`, `loadEntries`, `totalCents`, `validateEntries` are all `unlinked` — no intent provenance):

| Handoff | Draft |
|---|---|
| **Goal** | Ledger CLI에 `summary` 명령을 추가해 지정 월(`YYYY-MM`) 지출을 분류별로 항목 수·합계(센트)로 집계·출력한다. |
| **Scope** | `node src/cli.js summary --file <path> --month <YYYY-MM>` 지원(`--file`/`--month` 순서 무관); 해당 월만 집계; 분류별 `<category>\t<count>\t<amount_cents>`(분류명 오름차순); 마지막 `TOTAL\t…`; 잘못된/누락/무효 월은 stderr + exit 1, stdout 부분 결과 없음; `list`/`total` 유지. |
| **Non-goals** | `list`/`total` 입출력 변경; 금액 단위·데이터 스키마 변경; 새 의존성 추가; UI/리포트 포맷 확장; 다른 CLI 명령 추가. |
| **Success criteria** | `summary --file data/entries.json --month 2026-01` → PRD 예시 stdout; 해당 월 없으면 `TOTAL\t0\t0`; `2026-00`/`2026-13`/`2026-1`·누락·잘못된 옵션 → stderr + exit 1·stdout 비움; 기존 `list`/`total`·`npm test` 유지. |
| **Edge cases & failure modes** | 빈 월 → `TOTAL\t0\t0`만; 월 형식/범위 검증; 옵션 순서·누락·알 수 없는 플래그; 로드/검증 실패 시 기존처럼 stderr+1, 집계 전 실패면 부분 stdout 없음. |
| **Overlap** | 기존 epic/blueprint 없음; intent 전부 unlinked. `parseArgs`·`cli.js` 라우팅과 `ledger.js` 로드/합산을 확장하는 신규 스트림. |

---

**AskUserQuestion:**

1. **Re-ground**: Discovery 핸드오프(Goal / Scope / Non-goals / Success criteria / Edge cases & failure modes / Overlap)를 이대로 확정할지
2. **Recommend-why**: PRD와 현재 `list`/`total` 동작을 그대로 반영했고, 범위도 한 명령 추가로 좁혀져 있어 이 초안으로 진행하는 것이 맞음
3. **Options** (recommended-first):
   - A) 위 프레이밍으로 확정하고 Scaffold(ID·Light scope)로 진행 (Recommended)
   - B) 수정 요청 — Goal/Scope/Non-goals/Success criteria/Edge cases/Overlap 중 바꿀 항목을 적어 주세요
   - C) Cancel — `/bouncer-plan` 중단

회신 예: `A` 또는 `B: …`
