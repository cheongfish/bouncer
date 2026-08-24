---
type: bouncer.explain
title: 001 explain
description: Explain for 001
resource: .bouncer/context/epics/046-review-loop-cap/blueprints/001-execute-review-cap/explain.md
tags:
  - bouncer
  - explain
timestamp: '2026-08-24T13:22:49.645+09:00'
bouncer:
  id: EXPLAIN-001
  epic_id: '046'
  blueprint_id: '001'
  status: published
  comprehension:
    - range_from: develop
      range_to: 5d8669d34c923a67710c75800c79ebab71a7ce08
      diff_sha: 94cc22119332407a7a48a0f24d87727157a2b0d5ad85f67c693c8ab6970bf2ed
      quiz_score: '3/3'
      disposition: 리뷰 왕복 상한 소유권이 execute에 있고 run은 참조만 한다는 점과 accepted 금지를 확인함
      recorded_at: '2026-08-24T13:23:57+09:00'
---
# Explain

## Background
verify 경로는 실패 뒤 debugger 재호출 1회로 끝이 나는데, 리뷰 경로는
actionable finding이 남으면 "fix and re-review"만 있어 왕복이 끊기지 않았다.
그 숫자도 `/bouncer-run` step 4에만 있어서, `/bouncer-execute`를 단독으로
부르거나 멈춘 주행을 복구할 때는 상한이 없었다. 이번 변경은 리뷰 왕복 상한
2회와 `/bouncer-plan` 에스컬레이션·`accepted` 금지를 execute step 5에 두고,
run은 verify와 같은 형태로 그 숫자를 참조만 하게 맞췄다.

## Intuition
상한의 주인은 execute다. run은 같은 숫자를 되풀이하지 않고 가리키기만 한다.

## Code
- `skills/bouncer-execute/SKILL.md` step 5 (4): `at most **2** review
  round-trips`, 상한 도달 시 `/bouncer-plan`, remaining finding을 `accepted`로
  바꾸지 않음
- `skills/bouncer-run/SKILL.md` step 4: 왕복은 `/bouncer-execute`가 정한 대로
  **2회**, 루프가 별도 상한을 씌우지 않음
- 계약: `test/skill-bouncer-execute.test.js`, `test/skill-bouncer-run.test.js`
- 사용자 문서: `docs/workflow.md` 「알아둘 것」 — 단독 `/bouncer-execute`에도
  같은 2회가 걸림

## Quiz
1. 리뷰 재검 왕복 상한 숫자와 그 본문 소유 스킬은?
   - A) 1회, `/bouncer-run`
   - B) 2회, `/bouncer-execute`
   - C) 2회, `/bouncer-finalize`

2. 상한에 닿았을 때 컨트롤러가 하면 안 되는 처분은?
   - A) 남은 finding을 `accepted`로 바꿔 G8을 통과시킴
   - B) `/bouncer-plan`으로 에스컬레이션
   - C) 포인터를 그 task에 남기고 멈춤

3. `/bouncer-run` step 4의 리뷰 상한 문장이 verify 상한과 맞춰 추가한 소유권
   표현은?
   - A) 루프가 자체적으로 3회 상한을 더 둠
   - B) `scale: light`일 때만 상한을 적용함
   - C) `/bouncer-execute`가 정한 대로 **2회**이며, 루프가 그 위에 별도
     상한을 씌우지 않음

## 이해 상태
- quiz_score: 3/3
- 응답: 1B, 2A, 3C (모두 정답)
- 정답: 1B (2회·`/bouncer-execute`), 2A (`accepted`로 G8 통과 금지), 3C
  (execute 소유 참조·루프 별도 상한 없음)
- disposition: 리뷰 왕복 상한 소유권이 execute에 있고 run은 참조만 한다는 점과
  accepted 금지를 확인함
- range: develop..5d8669d34c923a67710c75800c79ebab71a7ce08
- diff_sha: 94cc22119332407a7a48a0f24d87727157a2b0d5ad85f67c693c8ab6970bf2ed
