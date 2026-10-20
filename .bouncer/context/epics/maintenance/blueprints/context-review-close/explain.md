---
type: bouncer.explain
title: 004 explain
description: Explain for 004
resource: .bouncer/context/epics/maintenance/blueprints/context-review-close/explain.md
tags:
  - bouncer
  - explain
timestamp: '2026-10-13T17:19:57.777+09:00'
bouncer:
  id: EXPLAIN-context-review-close
  epic_id: maintenance
  blueprint_id: context-review-close
  status: published
  comprehension:
    - range_from: eae1099b4d1232c15a220a230bcada9aaba86113
      range_to: b10c2d6e3952928ed2b9a5ce1aa12730eb2f41d6
      diff_sha: 65a785adee5817c0a664ec81a7528b46092d5c0b58b0a8a513b07ed6da710ecc
      recorded_at: '2026-10-13T17:28:00+09:00'
  task_commits:
    - task: maintenance/context-review-close/001
      sha: 61b80b00
      intent_anchor: task-001
    - task: maintenance/context-review-close/003
      sha: b10c2d6e
      intent_anchor: task-003
---
# Explain

## Background
기존 계획 검토(context review) 시스템은 discovery와 delta 최대 2회 라운드로 사이클을 제어합니다. delta 라운드가 끝난 뒤에도 open 상태인 must_fix finding이 남아 있으면 새 라운드 기록, 다음 라운드 배정, restart 전이가 모두 거절되어 사이클이 교착 상태에 빠졌습니다. 설령 사용자가 특정 위험을 감수하기로 승인하더라도, 계획 게이트(G18)가 resolved가 아닌 must_fix를 예외 없이 실패 처리하여 블루프린트를 닫을 수 없었습니다.

이번 변경은 라운드를 소모하지 않고 남은 finding 처분을 기록하는 처분 전용 `context-review close` 전이를 도입합니다. 사용자가 명시적으로 위험을 감수한 항목(`--accept-risk` 및 note 첨부)을 사이클 상태 및 투영에 반영하고, restart 및 계획 게이트(G18)가 이를 정당한 처분으로 인정하도록 합니다.

## Intuition
교착 상태에 빠진 계획 검토 사이클을 무리하게 새 라운드로 돌리지 않고, 위험 감수 합의서를 공증받아 공식적으로 사이클을 닫고 후속 단계로 넘깁니다.

## Code
- `scripts/src/lib/context-review-state.ts`:
  - `closeCycle`: `dispositions` 파일과 `acceptRisk` 입력을 받아 검증하고 불변 처분 파일과 `closure` 메타데이터를 저장하여 사이클을 닫습니다.
  - `projectClosure`: 사용자 동의로 승인된 finding에 `accepted_risk: true`를 마킹합니다.
  - `restartCycle`: 사이클이 닫힌 상태에서는 미해결 여부를 원시 보고가 아닌 닫힘 시점의 `projection` 기준으로 판정하여 restart를 허용합니다.
- `scripts/src/lib/cli-context-review-command.ts`:
  - CLI `bouncer context-review close` 명령 및 `--dispositions`, `--accept-risk` 인자 처리와 도움말을 추가합니다.
- `scripts/src/lib/validate-sections.ts`:
  - context namespace 검증 시 `status: accepted`, 비어 있지 않은 `note`, `accepted_risk: true`가 충족된 must_fix를 미해결 오류로 분류하지 않습니다. execute namespace(G14)는 기존 엄격한 기준을 유지합니다.

## Quiz
1. delta round 이후 미해결 open must_fix가 남아 다음 round 진행이나 restart가 모두 거절될 때, 사이클을 정상적으로 닫기 위해 취해야 하는 제품 동작은 무엇인가요?
   - A) round 3를 새로 열어 reviewer 재실행
   - B) 처분 전용 close 전이를 거쳐 사용자 동의와 함께 사이클 닫기
   - C) restart로 이전 finding을 지우고 처음부터 다시 시작
2. `context-review close`를 통해 accepted된 must_fix에 대해 plan gate(G18)가 검증을 통과시키는 기준은 무엇인가요?
   - A) note가 존재하고 accepted_risk: true로 표시된 경우에만 미해결 실패로 세지 않음
   - B) close 전이가 있으면 note 없이도 무조건 허용
   - C) execute namespace(G14)에서도 동일하게 accepted-risk 허용

## Tasks

### maintenance/context-review-close/001 · `61b80b00`

#### Goal & intent

`bouncer context-review close`로 마지막 round 뒤 남은 finding 처분을 사용자 동의(`--accept-risk`·note)와 함께 기록해 cycle을 닫는다. 닫힌 cycle은 restart할 수 있고, accepted-risk must_fix는 G18에서 미해결로 세지 않는다. 동의 없는 restart 우회는 계속 거절한다. 수용 기준은 Checklist의 테스트와 `npm run ci`다.

#### Current behavior

- 상수·타입(`scripts/src/lib/context-review-state.ts`): `REPORT_STATUS`(`:31`), `ROUND_MODES` discovery·delta(`:34`), `FINDING_STATUS` open·resolved·accepted(`:35`), `RESTART_LIMIT = 1`(`:27`). `State`(`:56-64`)는 `{ version, blueprint, cycle, transitions, closed, projection }`이고 `loadState`(`:377`, shape 검사 `:398`)가 검증한다.
- `foldReports`(`:466-481`)는 `active_reports`의 immutable 보고 파일만 읽어 finding id별 마지막 처분을 만든다.
- `recordReport`(`:748-866`)의 처리 순서:
  - 전이 키(`:787`)가 같으면 no-op이다.
  - 닫힌 cycle이면 거절한다(`:797`).
  - 기록된 round 번호를 다시 쓰면 `round N already recorded with different input`(`:801-805`)이다.
  - round 순서가 어긋나면 `context-review-round-order`(`:806-815`)이다.
  - `--status accepted`이면 `projectClosure`(`:712-732`)로 projection을 만들고 `closed`로 둔다(`:830-859`).
- `projectClosure`는 `open`, note 없는 accepted, `--accept-risk`에 없는 accepted must_fix, 대응 finding이 없는 `--accept-risk`를 `context-review-unresolved-findings`로 거절한다. 통과한 finding에 표시를 남기지 않는다.
- `restartCycle`(`:882-1012`)은 `closed`를 보지 않는다. active 보고가 2개 이상이고 folded must_fix가 `open`이면 `must_fix remains open after the delta round`(`:933-937`)로 거절한다. 성공하면 `closed=false`, `projection=null`(`:1001-1002`)로 바꾼다.
- `routeFollowUp`(`:1036-1095`)은 닫히지 않은 cycle에 delta 뒤 open must_fix가 있으면 `user`(`:1074-1080`)를 낸다.
- 안내 `next` 문자열은 `:729`, `:936`, `:1079`에 리터럴로 있다.
- 잠금은 `withLock`(`:322-346`), 쓰기는 `writeAtomic`(`:140`)·`writeImmutable`(`:175`)·`saveState`(`:422`)이다. record는 잠금 안에서 `readLegacy`·`reconcileMarker`(`:780-783`)를 확인한다.
- CLI(`scripts/src/lib/cli-context-review-command.ts`)의 구성:
  - `USAGE_BLOCK`(`:13-14`), `USAGE`(`:16-23`), `HELP`(`:25-43`)
  - `Parsed.verb` union(`:65`), `parseArgs`(`:83-128`). `--round`·`--status`·`--accept-risk`는 record에서만 허용한다(`:106-108`).
  - `cmdContextReview`(`:138-165`)는 exit 0·1·2로 끝난다.
- G18은 `validate-gates.ts:903-951`에서 status accepted를 확인한 뒤 finding 실패를 모은다. 공유 검사 `scripts/src/lib/validate-sections.ts:329-330`은 review가 accepted여도 must_fix가 `resolved`가 아니면 `accepted with open must_fix <id>`로 실패시킨다. 이 검사는 execute namespace(G14)와 공유한다.
- 문서: `skills/bouncer-plan/references/context-review.md:94-120`·`:160-170`, `rules/cli.md:206-216`, `rules/document-schema.md:135`.
- 재현:
  - `npm run build` 뒤 `node --test test/context-review-state.test.js test/validate-gates.test.js test/review-record.test.js test/cli-help.test.js`를 실행한다.
  - 헬퍼: `MUST_FIX`(`test/context-review-state.test.js:19-31`), `roundFile`(`:87`), `start`·`record`·`restart`(`:102-110`), `changeDocs`(`:127`), `route`·`cycleAfterDelta`(`:702-731`).
  - delta 뒤 restart 거절 케이스: `:186-196`.

#### Target behavior

- 성공(close):
  - 기록된 round가 1개 이상이고 닫히지 않은 cycle에서 `close`를 실행한다.
  - `--dispositions`의 각 `{ id, status, note }`를 folded finding 위에 덮어쓴 결과가 `projectClosure`를 통과하면, dispositions를 immutable 파일로 저장한다.
  - `state.closure = { dispositions: Ref, accept_risk }`, `closed: true`, `projection = { findings, rounds: folded.rounds }`로 바꾼다.
  - `active_reports`·`latest_dispatch`·`restart_count`는 그대로다.
- 성공(표시): `projectClosure`를 통과한 must_fix 중 `--accept-risk`에 있는 finding은 projection에서 `accepted_risk: true`를 갖는다. record·close 모두 같다.
- 성공(restart): 닫힌 cycle은 미해결 검사를 `projection` 기준으로 하므로 `close` 뒤 restart가 성공한다. history 보관 항목에 `closure`가 포함된다.
- 성공(문서 변경 뒤 close): 마지막 round 뒤 문서가 바뀐 cycle도 `close`는 성공한다. 그 뒤 G18은 기존대로 `context review is stale`을 내고, route는 `restart_count` 0이면 `restart`, 1이면 `context-review-restart-limit`(`user`)이다.
- 성공(G18): context namespace에서 `status: accepted`, note가 비어 있지 않고 `accepted_risk: true`인 must_fix는 `accepted with open must_fix`를 내지 않는다.
- 실패:
  - 닫힌 cycle·round 없는 cycle의 `close`는 `context-review-state-conflict`다.
  - 처분 뒤 `open`이 남거나 note가 없거나 `--accept-risk`가 어긋나면 `context-review-unresolved-findings`다.
  - 기록에 없는 id, 중복 id, `status`가 `resolved`·`accepted` 밖이거나 JSON이 깨진 경우는 `context-review-input-invalid`다.
  - 모든 실패는 state를 바꾸지 않는다.
- 보존:
  - `close` 없이 delta 뒤 open must_fix가 있으면 restart(`:933-937`)와 route(`:1074-1080`)는 계속 거절·`user`를 낸다. 단, 안내 `next`는 `context-review close`를 가리킨다.
  - restart 1회 한도, round 순서, execute G14 판정, `accepted_risk` 없는 accepted must_fix의 G18 실패는 그대로다.

#### Interface

- 제공:
  ```ts
  function closeCycle(input: { repoRoot: string; blueprintDir: string; dispositionsFile: string; acceptRisk?: string[] }): Record<string, unknown>;
  type Closure = { dispositions: Ref; accept_risk: string[] };
  // State.closure?: Closure; projection finding: accepted_risk?: true
  ```
  - CLI: `bouncer context-review close --blueprint <dir> --dispositions <json> [--accept-risk <id[,id...]>] [--repo <dir>]`. `--accept-risk`는 record·close에서 허용된다. usage·HELP에 close가 나온다.
  - 전이 키: `[cycle.id, restart_count, 'close', sha256(<dispositions 파일 원본 바이트>), <중복 제거·정렬한 acceptRisk>.join(',')]`. 같은 키면 no-op이다.
- 거부:
  - 즉시 실패(exit 2): `--dispositions` 누락, close에 `--round`·`--status`·`--dispatch`.
  - 거절(exit 1): 위 Target의 실패 reason들.
  - G18: `accepted_risk`가 `true`가 아니거나 note가 비면 기존대로 실패한다. execute namespace에는 `accepted_risk`를 인정하지 않는다.

#### Touch

| 경로 | 심볼 | 변경 | 현재 책임 | 계획한 변경 | 근거 |
| --- | --- | --- | --- | --- | --- |
| `scripts/src/lib/context-review-state.ts` | `projectClosure`, `restartCycle`, `routeFollowUp` next, `loadState`, 신규 추출 지점: `closeCycle` | Modify | cycle 전이·잠금·projection | close 전이, `accepted_risk` 표시, 닫힌 cycle restart, `closure` 검증·보관, next 문구 | 상태 기계 소유 |
| `scripts/src/lib/cli-context-review-command.ts` | `Parsed.verb`, `parseArgs`, `USAGE`, `HELP`, `cmdContextReview` | Modify | context-review CLI | `close` verb와 플래그 | CLI 표면 |
| `scripts/src/lib/validate-sections.ts` | must_fix accepted 검사(`:329-330`) | Modify | G14·G18 finding 실패 수집 | context namespace에서 `accepted_risk` must_fix 허용 | G18 판정 |
| `test/context-review-state.test.js` | 신규 케이스 | Modify | cycle 전이 검증 | close 성공·거절·no-op·restart·route 케이스 | 전이 회귀 |
| `test/validate-gates.test.js` | G18 must_fix 케이스 | Modify | G18 검증 | `accepted_risk` 허용·불허 케이스 | gate 회귀 |
| `test/cli-help.test.js` | context-review help 케이스(`:489-504`) | Modify | help·usage 검증 | close usage 노출 | CLI 표면 |
| `skills/bouncer-plan/references/context-review.md` | 미해결 must_fix·route·record 절(`:94-120`, `:160-170`) | Modify | plan context review 절차 | 사용자 명시 승인 뒤에만 `close`를 실행하는 절차와 close→restart 복구 | 절차 문서 |
| `rules/cli.md` | context-review 명령 설명(`:206-216`) | Modify | CLI 계약 | `close` 추가 | 명령 목록 |
| `rules/document-schema.md` | context-review 소유 문장(`:135`) | Modify | 문서 schema 규칙 | 명령 목록에 `close`, `accepted_risk` 필드 | schema 문서 |
| `CHANGELOG.md` | `## [Unreleased]` | Modify | 변경 이력 | 이 수정 항목 | 변경 기록 |

#### Constraints

- 새 쓰기는 기존 순서(immutable 파일 → `saveState`)와 `withLock`·`reconcileMarker` 확인을 따른다.
- `closure`가 없는 기존 `state.json`은 그대로 읽힌다(선택 필드).
- `accepted_risk`는 CLI가 projection에만 쓴다. 사람이 손으로 붙인 값은 reference가 금지하고, G18은 note와 함께일 때만 인정한다. G18은 runtime `closure`와 교차 검사하지 않는다(`resolved` 수기 편집과 같은 기존 경계).
- 주석·docstring은 `references/coding-standards/index.md`의 한국어 계약을 따른다.

### maintenance/context-review-close/002

#### Goal & intent

TASKS-001이 integration에 통합된 상태에서 `npm run ci`가 통과해 close 전이·restart·G18 변경과 문서가 빌드·테스트·lint·typecheck를 함께 통과함을 증명한다.

#### Interface

- 제공: 선행 task가 모두 통합된 상태에서 verify 명령이 남기는 종단 검증 증적.
- 거부: source 변경, review 문서, commit.

#### Touch

Source 변경 경로 없음.

### maintenance/context-review-close/003 · `b10c2d6e`

#### Goal & intent

기록된 terminal CI 실패를 복구한다.

#### Interface

- 제공: 실패 command와 관련 경로를 통과시키는 최소 수정
- 거부: Blueprint 밖 scope와 새 기능

#### Touch

- Modify `scripts/src/lib/context-review-state.ts` — 기록된 CI 실패를 복구한다.
- Modify `test/context-review-state.test.js` — 기록된 CI 실패를 복구한다.

#### Constraints

- 원장의 실패 증적과 repair 결정 범위만 따른다.