I'll run `/bouncer-plan` for the monthly summary PRD: load Bouncer rules, preflight the plan state, then work through discovery and the required decision gates.No selection is active. Next I'll load discovery rules and ground the PRD in the current Ledger CLI checkout.Next I'll pull intent for the related CLI/ledger symbols, then surface any open decisions before the Discover ACQ.**Preflight:** `current.status` is `empty` — no blueprint/task/base is selected (pointer fields are null). Suggested next epic id: `001`. Verify signal present: `package.json#scripts`.

**Discovery evidence (grounded):**
- CLI today: `list` | `total` only; args are rigid (`command`, `--file`, path) in `src/cli.js`
- Ledger: `loadEntries` / `validateEntries` / `totalCents` in `src/ledger.js`; dates `YYYY-MM-DD`, amounts integer cents
- Fixture `data/entries.json` matches the PRD sample for `2026-01`
- Tests: `test/ledger.test.js` via `npm test`; no epics, no CONTRIBUTING/AGENTS/CI
- `bouncer intent` for `parseArgs`, `loadEntries`, `validateEntries`, `totalCents`, `main`: all `unlinked` (no provenance)

Before the Discover confirm gate, I need your answers on the open decisions the PRD and code leave unsettled:

---

**Open decisions** (reply with answers for each):

**1. stderr 오류 문구**  
PRD는 잘못된 옵션·누락·유효하지 않은 월에 대해 stderr + exit 1을 요구하지만, 문구는 정하지 않았습니다. 기존은 `usage: node src/cli.js <list|total> --file <path>` 한 줄입니다.

- A) 기존처럼 usage 한 줄로 통합 (예: usage에 `summary`·`--month` 포함)
- B) 실패 종류별 구체 메시지 (누락 / 잘못된 월 `2026-13` / 알 수 없는 옵션 등)
- C) 다른 문구 지정 (직접 적어 주세요)

**2. 분류명이 리터럴 `TOTAL`인 경우**  
검증은 category를 비어 있지 않은 문자열만 요구합니다. 해당 월에 `TOTAL` 분류가 있으면 분류 줄과 합계 줄이 둘 다 `TOTAL\t...`로 나옵니다.

- A) 허용 — 분류 줄도 `TOTAL`로 출력하고, 마지막 합계 줄도 그대로 `TOTAL\t...` (PRD 형식 유지)
- B) 거부 — 해당 월에 category `TOTAL`이 있으면 stderr 오류·exit 1
- C) 합계 접두어를 바꿈 (예: `ALL`) — 원하시면 접두어를 지정해 주세요

**3. 검증 실패가 여러 개일 때의 우선순위**  
예: `--month`가 잘못됐고 파일도 없을 때.

- A) 인자 파싱/월 검증을 파일 로드보다 먼저 (현재 `parseArgs` → `loadEntries` 흐름과 동일)
- B) 다른 우선순위 지정

답변 주시면 그에 맞춰 framing을 확정한 뒤 **AskUserQuestion — plan.discovery**로 Goal/Scope 확인을 요청하겠습니다.
