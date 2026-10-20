---
type: bouncer.blueprint
title: delta 뒤 고친 must_fix를 restart로 다시 리뷰하도록 수정
description: Allow context review restart when the open must_fix target sections were edited after the delta round
resource: .bouncer/context/epics/plan-workflow/blueprints/context-review-fix-restart/index.md
tags:
  - bouncer
  - blueprint
  - context-review
  - restart
  - must-fix
timestamp: '2026-10-20T21:01:49.577+09:00'
bouncer:
  id: context-review-fix-restart
  epic_id: plan-workflow
  blueprint_id: context-review-fix-restart
  status: approved
  order: 1
  commit_type: fix
  scale: full
  review_scope: blueprint
  verification_policy: scoped_terminal
  attribution: 수용 기준의 중심이 bouncer-plan context review restart 동작이라 plan-workflow 영역이다
  supersedes: []
---
# context-review-fix-restart

Epic: [plan-workflow](../../index.md)

## Intent
- 문제: delta 라운드 뒤 열린 `must_fix`를 사용자가 고치면 `context-review restart`와 `close`가 서로를 가리키며 거절해, 고치기 전 문서만 승인할 수 있다.
- 완료 조건: 열린 `must_fix` 대상 섹션을 고친 계획은 본문만 바뀌었으면 `close`로, 계약·구조도 바뀌었으면 `restart`로 나가고, 고치지 않은 계획은 지금처럼 사용자에게 멈춘다.

## Contract
- 인터페이스: `bouncer context-review route`와 `bouncer context-review restart`의 판정만 바뀐다. 새 플래그·명령·거절 코드는 없다. route의 `next_action` 값 집합(`reuse | close | delta | restart | user`)과 `close`의 dispositions 계약은 그대로다.
- 데이터·상태: 새 상태 필드는 없다. "고쳐짐" 판정 입력은 마지막 리뷰 dispatch 저장본(`latest_dispatch`)의 `documents_content`와 새 dispatch의 `documents_content`다. 둘 다 `loadDispatch`가 현재 blueprint에서 다시 계산해 대조한 값이라, payload의 `changed_documents`·`revision_diff`는 판정에 쓰지 않는다.
- 판정 규칙(delta를 쓴 열린 cycle, 열린 `must_fix` 존재 시, 위에서부터 첫 일치):
  1. 열린 `must_fix`가 모두 고쳐졌고 구조·Interface/Touch 계약이 baseline과 같다(본문만 변경) → route `close`. 사용자는 고친 finding을 `resolved` disposition으로 `close`해 현재 digest를 인증한다.
  2. 모두 고쳐졌고 구조나 Interface/Touch 계약이 바뀌었다 → route `restart`, `restart`도 받아들인다(한도 1회 유지).
  3. 하나라도 고쳐지지 않았다 → route `user`, `restart`는 `context-review-unresolved-findings`(현행).
  4. 기준 저장본에 `documents_content`가 없다(legacy·이전 snapshot 형식) → 3과 같다.
- 수용 기준:
  1. 대상 섹션 본문만 고친 dispatch로 route가 `close`를 내고, 그 finding을 `resolved`로 둔 `close`가 성공한다.
  2. 대상 섹션과 Interface를 함께 고친 dispatch로 route가 `restart`를 내고, `restart` 성공 → discovery 재기록 → `close`까지 이어진다.
  3. 대상과 무관한 섹션만 바뀐 dispatch로는 route `user`, `restart`는 `context-review-unresolved-findings`다.
  4. restart 한도(1회)를 쓴 뒤에는 규칙 2 조건이어도 `context-review-restart-limit`이다.
  5. `skills/bouncer-plan/references/context-review.md`가 위 세 결과(close·restart·user)만 안내한다.
- 검증 명령: 태스크별 `node --test …`, 종단 `npm run ci`.
- 실패 모드·엣지 케이스:
  - 열린 `must_fix`가 여럿이면 하나라도 대상 섹션이 그대로일 때 규칙 3이다.
  - finding `symbol`에 맞는 heading을 이전·새 본문 중 한쪽에서라도 찾지 못하면 그 finding은 고쳐지지 않은 것으로 본다. `symbol`이 `-`이면 `file` 본문 전체를 비교한다.
  - `close`는 지금처럼 사용자가 준 `resolved`를 증명 없이 받는다. 이 blueprint는 route가 `close`를 권하는 조건만 정하고 `close` 검증을 바꾸지 않는다.
  - 닫힌 cycle의 restart는 지금처럼 projection finding을 기준으로 같은 판정을 쓴다.

## Out of scope
- 열린 finding만 다시 판정하는 verify-fix 전용 라운드(개선 후보 2).
- `close --accept-risk`가 계약 변경을 받아들이도록 완화하는 일(개선 후보 3).
- restart 한도·delta 횟수 변경.
- reviewer 프롬프트와 finding 스키마 변경.

## One-commit justification
- restart·route 판정 한 곳과 그 안내 문서를 함께 바꿔야 skill이 불가능한 선택지를 내지 않으므로 한 PR로 묶는다.
