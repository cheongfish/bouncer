# Retro: EPIC 096 / BP 001 계획 리뷰 반복 제어와 이력 보존

- 날짜: 2026-10-12
- 근거: 해당 /bouncer-run·/bouncer-finalize 세션 대화 (PR #200)
- 범위: 개선 후보 제안만 담는다. 규칙·검사는 이 문서로 바뀌지 않으며, 채택은 별도 `/bouncer-plan`으로 진행한다.

## 후보 1. 코디네이터가 `review_risk: public_interface` task에 리뷰어를 띄우지 않음

- 문제와 근거: task 001은 `review_risk: public_interface`였지만 첫 코디네이터 보고에 "No review stop appeared in the flow"로 적혀 있었다. 설계 불일치는 blueprint 최종 리뷰에서야 발견됐고, 그 결과 repair wave(task 003)가 필요했다.
- 기존 장치: `review_scope: blueprint`의 최종 리뷰. 이번에는 정상 동작해 불일치를 잡았다.
- 수정 대상: 역할 절차 (`agents/bouncer-coordinator.md`)
- 변경 방향: blueprint 최종 리뷰 전에 Contract의 저장 위치·인터페이스 문구와 구현이 일치하는지 확인하는 점검 한 줄을 추가한다.
- 기대 효과와 비용: repair wave 한 번을 줄일 수 있다. 비용은 작다.

## 후보 2. Contract와 task 브리프가 서로 어긋난 채 계획이 승인됨

- 문제와 근거: Contract는 사이클을 `context-review.md`의 `bouncer.context_review.cycle`에 둔다고 했지만, task 001 브리프는 "cycle-owned runtime"이라고만 적었다. 구현은 런타임 `state.json`에 저장해 두 문서가 충돌했다.
- 기존 장치: plan 단계의 context-review(`bouncer-context-reviewer`). 이 어긋남은 걸러내지 못했다.
- 수정 대상: 역할 절차 (`agents/bouncer-context-reviewer.md`)
- 변경 방향: Contract의 저장 위치 문구와 각 task 브리프의 해당 문구를 대조하는 항목을 추가한다.
- 기대 효과와 비용: 구현 후 설계 결정이 뒤집히는 일을 줄인다. 리뷰 한 항목이 늘어난다.

## 후보 3. `coordinate advance`가 간헐적으로 `unclear-result`를 반환함

- 문제와 근거: 첫 코디네이터가 `bouncer coordinate advance`(`--task` 없음)가 `ok:false, reason:unclear-result` ("automatic action stdout was not a JSON object")를 반환했고, 그때마다 실제 동작은 이미 실행된 상태였다고 보고했다. 실제 상태는 `coordinate next|status`로만 확인할 수 있었다.
- 기존 장치: 없음.
- 수정 대상: 테스트 또는 gate
- 변경 방향: 자동 동작의 stdout이 항상 JSON 객체인지 검증하는 테스트를 추가한다. 후속 task로 남겨 사용자가 채택한다.
- 기대 효과와 비용: 코디네이터가 `advance` 결과를 오해하지 않는다. 원인 조사 비용이 든다.
