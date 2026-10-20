---
type: bouncer.tasks
title: 고친 must_fix 대상 섹션이 있으면 context review restart를 허용함
description: Let context-review restart and route accept a dispatch whose open must_fix target sections changed after the delta round
resource: .bouncer/context/epics/plan-workflow/blueprints/context-review-fix-restart/tasks/001/tasks.md
tags:
  - bouncer
  - tasks
  - context-review
  - restart
timestamp: '2026-10-20T21:01:49.577+09:00'
bouncer:
  id: TASKS-001
  epic_id: plan-workflow
  blueprint_id: context-review-fix-restart
  status: ready
  execution_kind: commit
  depends_on: []
  parallel_safe: true
  dependency_gate: integrated
  review_risk: []
  verify: node --test test/context-review-state.test.js
  affected_paths:
    - scripts/src/lib/context-review-state.ts
    - test/context-review-state.test.js
  commit_intent:
    - delta 뒤 열린 must_fix를 고친 계획이 restart와 close 모두에서 막히는 교착을 해소함
  commit_summary:
    - 열린 must_fix 대상 섹션이 고쳐졌으면 본문만 바뀐 경우 close로, 계약이 바뀐 경우 restart로 안내함
---
# Tasks

Blueprint: [context-review-fix-restart](../../index.md)

## Goal & intent
delta 라운드 뒤 열린 `must_fix`의 대상 섹션을 고친 계획이 막히지 않게 한다. 본문만 고쳤으면 route가 `close`를, 계약·구조도 바뀌었으면 route가 `restart`를 내고 `restart`가 받아들인다. 고치지 않은 계획, legacy 기준, 한도 소진은 지금처럼 거절한다. 수용 기준은 blueprint Contract 수용 기준 1~4이고 검증 명령은 `node --test test/context-review-state.test.js`다.

## Current behavior
- `restartCycle`(`scripts/src/lib/context-review-state.ts:1320`)은 `state.cycle.active_reports.length >= 2`이고 open `must_fix`가 하나라도 있으면 수정 내용을 보지 않고 `context-review-unresolved-findings`로 거절한다(`:1374-1380`). 닫힌 cycle은 `state.projection.findings`, 열린 cycle은 `foldReports` 결과를 본다(`:1370-1373`).
- `routeFollowUp`(`:1511`)의 3단계(`:1552-1560`)는 닫히지 않은 cycle에서 round가 `ROUND_MODES.length`에 이르고 open `must_fix`가 있으면 `route('user', 'context-review-unresolved-findings', …)`를 돌려준다. 6단계 restart 판정(`:1577-1584`)까지 가지 않는다.
- 한편 `closeCycle`(`:1129`)은 baseline과 구조·계약이 다르면 `context-review-state-conflict`로 거절한다(`:1221-1232`). 그래서 고친 사용자는 restart·close 어느 쪽으로도 나갈 수 없다.
- 입력: `loadDispatch`(`:251-314`)는 payload의 `parts`·`scope_parts`·`structure_parts`·`documents_content`를 현재 blueprint에서 다시 계산해 같을 때만 받는다. `changed_documents`·`revision_diff`는 대조하지 않는다. 마지막 리뷰 dispatch 원문은 `readRef(ctx, repoRoot, state.cycle.latest_dispatch)`(`:466`)로 읽는다.
- finding의 `file`은 계획 문서 저장소 상대 경로, `symbol`은 절 heading의 slug 또는 `-`다(`agents/bouncer-context-reviewer.md:181-182`). `documents_content`는 문서 경로 → `{ body, structure }`다(`scripts/src/lib/plan-snapshot.ts:143-160`).
- 재현: `test/context-review-state.test.js:231`의 "delta 뒤 미해결 must_fix가 남은 상태의 restart" 테스트가 `changeDocs`로 본문을 바꾼 뒤에도 `context-review-unresolved-findings`를 확인한다. 확인한 명령은 `npm run build && node --test test/context-review-state.test.js`다.

## Target behavior
- 판정 순서(delta를 쓴 열린 cycle, 열린 `must_fix` 존재 시, 첫 일치):
  1. 모두 고쳐짐 + `compareShape(baseline, newPayload)`의 `structure`·`scope`가 모두 같음 → `routeFollowUp`은 3단계에서 멈추지 않고 4단계 `close`(`context-review-close-available`)를 낸다. `closeCycle`은 바꾸지 않는다: 본문만 바뀐 snapshot은 이미 `sameStructureAndScope` 검사를 통과하고(`:1221-1232`), dispositions의 `resolved`는 `CONTEXT_REVIEW_STATUS` 검사만 받는다(`:1258-1266`). 그래서 고친 finding을 `resolved`로 둔 `close`가 성공한다.
  2. 모두 고쳐짐 + 구조나 계약이 다름 → `routeFollowUp`은 6단계 `restart`를, `restartCycle`은 `:1374` 거절을 건너뛰고 기존 흐름(직전 digest 동일 검사 → archive → discovery 재개)으로 `ok: true`를 낸다.
  3. 하나라도 고쳐지지 않음 → route `user`, restart `context-review-unresolved-findings`(현행).
  4. 기준 저장본에 `documents_content`가 없거나 finding `file`이 어느 한쪽에 없음 → 3과 같다.
- "고쳐짐"(finding 하나): 기준 = `latest_dispatch` 저장본의 `documents_content`, 새 내용 = 이번 dispatch의 `documents_content`. `symbol`이 `-`이면 `file` 본문이 다를 때, 아니면 Interface의 섹션 일치 규칙으로 찾은 섹션 본문이 양쪽에 있고 서로 다를 때다.
- `restartCycle`은 규칙 1 상황(본문만 변경)에서도 모두 고쳐졌으면 restart를 받아들인다. route가 `close`를 권할 뿐 restart를 막지 않는다.
- 보존: open `must_fix`가 없을 때, discovery만 기록된 cycle, 닫힌 cycle의 projection 기준 판정, 직전 digest 동일 시 `context-review-state-conflict`, `restart_count` 한도 검사가 판정보다 먼저인 순서, 한도 1회는 바뀌지 않는다. 거절 `next` 문구는 "restart cannot resolve findings" 대신 "대상 섹션을 고치면 route가 close 또는 restart를 안내한다"는 내용으로 바꾼다.

## Interface
- 제공: 내부 판정 `신규 추출 지점: 열린 must_fix가 모두 고쳐졌는지 판정` — 입력 `(findings: Finding[], baseline: Record<string, {body: string}> | undefined, current: Record<string, {body: string}>)`, 출력 `boolean`. `restartCycle`과 `routeFollowUp` 3단계가 같은 함수를 부른다. CLI 플래그·출력 모양·reason 코드는 그대로다.
- 섹션 일치 규칙: finding `symbol`과 각 heading 텍스트를 소문자로 바꾸고 영숫자(한글 포함)가 아닌 문자를 모두 지운 값이 같으면 그 heading의 섹션이다. 예: `goal-intent` → `goalintent`, `## Goal & intent` → `goalintent`로 일치. 섹션 본문은 그 heading 줄부터 같은 단계 이상의 다음 heading 직전까지다.
- 거부: 판정이 `false`이면 restart는 `context-review-unresolved-findings`, route는 `user`. payload의 `changed_documents`·`revision_diff`는 판정 입력으로 쓰지 않는다(`loadDispatch`가 대조하지 않는 값이라 위조 가능).

## Touch
| 경로 | 심볼 | 변경 | 현재 책임 | 계획한 변경 | 근거 |
| --- | --- | --- | --- | --- | --- |
| `scripts/src/lib/context-review-state.ts` | `restartCycle`, `routeFollowUp`, `신규 추출 지점: 고쳐짐 판정` | Modify | delta 뒤 open must_fix면 수정 여부와 무관하게 restart 거절, route는 user | 기준·새 `documents_content`로 대상 섹션 수정 여부를 판정해 본문만 변경이면 route `close`, 계약 변경이면 route·restart가 `restart`를 허용 | 거절 분기 `:1374-1380`, `:1552-1560`이 교착의 직접 원인 |
| `test/context-review-state.test.js` | delta 뒤 restart·route 회귀 테스트 | Modify | `:231`이 본문 수정 뒤에도 거절만 확인 | close·restart 두 성공 흐름과 무관 수정·한도·legacy 거절을 단언 | 검증 지점 |

## Do not touch
- `scripts/src/lib/review-dispatch.ts` — payload 생성·`changed_documents` 계산은 바꾸지 않는다.
- `scripts/src/lib/validate-sections.ts` — fingerprint 형식은 그대로다.
- `skills/bouncer-plan/references/context-review.md` — TASKS-002 소유.
- `agents/bouncer-context-reviewer.md` — reviewer 계약 변경 없음.

## Constraints
- `RESTART_LIMIT`(1)과 `ROUND_MODES` 길이는 바꾸지 않는다.
- 판정 함수는 파일을 읽지 않는다. 기준 내용은 이미 `readRef`로 읽은 `latest` 원문에서 꺼낸다.
- `closeCycle`의 conflict 검사는 손대지 않는다.
- 기존 `test/context-review-state.test.js:231` 테스트는 "무관 섹션만 바뀐 경우"로 의미를 유지하도록 고치되, 기대 reason은 그대로 둔다.

## Checklist
- [ ] 실패 테스트를 먼저 추가한다. fixture는 `MUST_FIX`의 `file`을 blueprint `index.md` 상대 경로로, `symbol`을 `intent`로 바꿔 `withFingerprint`로 다시 만들고, discovery(r1)·delta(r2) 둘 다 이 finding을 open으로 기록한다.
  ```js
  // A. 본문만 수정: index.md `## Intent` 본문 변경
  assert.equal(routeOf(repo, d2).json.next_action, 'close'); // 기대 red: 현재 'user'
  // 이어서 dispositions [{ id: 'CR-1', status: 'resolved' }]로 close → code 0
  // B. 계약 수정: `## Intent` 본문 + writeTask(repo, '- `fnB`\n')로 Interface 변경
  assert.equal(routeOf(repo, d2).json.next_action, 'restart'); // 기대 red: 현재 'user'
  assert.equal(restart(repo, d2).code, 0);                      // 기대 red: 현재 code 1
  // 이어서 discovery round 기록 → close 성공
  ```
- [ ] 거절 단언을 추가한다: `## Intent`가 아닌 섹션만 바꾼 dispatch → route `user`, restart `context-review-unresolved-findings`; B 흐름에서 restart를 한 번 쓴 뒤 다시 delta 뒤 같은 조건을 만들면 → `context-review-restart-limit`; 저장된 latest dispatch에서 `documents_content`를 지운 경우 → route `user`.
- [ ] 섹션 일치 단언: `symbol: 'goal-intent'`이 `## Goal & intent`를 찾는다.
- [ ] `npm run build && node --test test/context-review-state.test.js`로 A·B 흐름 테스트가 실패하는 것을 확인한다.
- [ ] 고쳐짐 판정을 추출하고 `restartCycle`의 `:1374` 분기와 `routeFollowUp` 3단계에 연결한다. 3단계는 모두 고쳐졌으면 다음 단계(4 close / 6 restart)로 내려간다. 거절 `next` 문구를 바꾼다.
- [ ] `npm run build` 뒤 `node --test test/context-review-state.test.js`가 통과한다.
