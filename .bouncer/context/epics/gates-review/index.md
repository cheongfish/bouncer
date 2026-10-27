---
type: bouncer.epic
title: 120 gates-review
description: 'Judgement: gate codes, verification evidence, review dispatch and coding standards'
resource: .bouncer/context/epics/gates-review/index.md
tags:
  - bouncer
  - epic
timestamp: '2026-10-20T16:05:56.695+09:00'
bouncer:
  id: gates-review
  epic_id: gates-review
  status: approved
  supersedes: []
---
# 120 gates-review

## Intent
- 문제: 기능 영역이 같은 작업이 legacy epic 63개에 흩어져 있고, 등록부 도입 뒤 이 저장소에는 새 blueprint를 만들 활성 epic이 없다.
- 목표: 이 epic이 `gates-review` 영역의 새 blueprint를 받는다. 포함: 검증과 리뷰: `bouncer validate` gate 코드, verify 증적과 재사용, 리뷰 관점·디스패치·라운드, 코딩·테스트 표준

## Success criteria
1. `gates-review` 영역에 속하는 새 계획은 이 epic 아래 blueprint로 만든다.
2. 아래 legacy epic은 `legacy`로 그대로 두고 조회·이력에만 쓴다. 승인·검증 해시와 trailer 연결을 바꾸지 않는다.
3. G10·G11·G12·G18·G22·G25·G26–G31 조건만 어긋난 approved blueprint에서 `bouncer validate --gate plan`이 `ok: true`이고 출력에 해당 코드가 없다.
4. G1–G3·G5·G19·G20과 S 코드는 삭제 전과 같은 입력에서 같은 코드로 실패한다.
5. execute G14와 finalize G21은 finding·round 형식 위반만으로는 실패하지 않고, open `must_fix`, 열린 finding이 남은 accepted review, review 부재·미승인, round 부재, 배열이 아닌 findings, enum 밖이거나 누락된 finding status·actionability에서는 계속 실패한다.
6. G6·G7·G8·G13·G16·G17·G23·G24 판정은 바뀌지 않는다.
7. plan draft 검사(`review-dispatch plan`)는 G5·G19·G20만 보고한다.
8. 플러그인 rules·references·skills·agents·docs가 삭제된 코드를 gate 판정으로 서술하지 않고, CHANGELOG `[Unreleased]`에 `Removed` 항목이 있으며 `npm run ci`가 통과한다.
9. G-code가 하나 이상 실패한 `bouncer validate` 결과는 최상위 `gates[]`에 실패한 복합 gate만 고정 순서로 싣고, 각 항목은 `gate`·`label`·`codes`·`targets`·`next`(문자열 1개)를 가지며 길이는 7 이하다.
10. 같은 입력에서 `failures[]`의 `code`·`message`·`file`·`next`와 `ok`·`warnings`는 `gates[]` 도입 전과 같고, 실패가 S 코드뿐이거나 `ok: true`이면 결과에 `gates` 키가 없다.
11. `current --set`·`bouncer commit`·`finalize`의 validate 실패 payload는 `failures`와 함께 같은 `gates[]`를 싣는다.
12. 경계 거절 reason 7종(`out-of-scope`·`main-worktree-source-write`·`unassigned-worktree`·`verification-task-no-commit`·`cross-drive-conflict`·`cross-drive-ledger-unreadable`·`stale-revision`)은 commit·coordinator 실패 payload에 `gate` 필드를 갖고 commit hook 거절 줄에 복합 gate 이름이 붙으며, 그 밖의 reason에는 `gate` 키가 없고 `reason` 값은 바뀌지 않는다.
13. 새 테스트 파일은 `test/tiers.json`에 등록되고, `rules/output.md`·`rules/cli.md`가 복합 gate 출력을 서술하며, CHANGELOG `[Unreleased]`에 `Added` 항목이 있고 `npm run ci`가 통과한다.
14. `bouncer.review_contract: brief` blueprint의 최종 리뷰 discovery 관점은 `review_risk: [public_interface]`일 때 `spec_scope`·`correctness_tests` 두 개이고, `authentication`·`authorization`·`credential` 중 하나가 있으면 `security`가 더해진다.
15. 같은 blueprint에서 브리프 위반 `must_fix`가 있는 최종 리뷰는 리뷰 원인 repair 1회와 delta 1회를 거쳐 `accepted`로 닫히고, delta 뒤에도 위반이 남으면 `coordinate next`가 `final-review-blocked`를 내며, 그 뒤의 delta·리뷰 원인 repair는 `final-review-single-round`로 거절된다.
16. `review_contract: brief` blueprint의 최종 리뷰 record는 `brief_clause`가 브리프 조항 참조(`tasks/<NNN> <브리프 섹션>` 또는 `Contract`로 시작)가 아닌 `must_fix` finding과 `deferred` `must_fix`가 남은 accepted 문서를 거절한다.
17. `review_contract`가 없는 blueprint와 이미 저장된 단일 라운드 root `review.md`는 개편 전과 같은 관점·거절·G21 판정을 받는다.

18. R-M3·R-A7·R-A8 범위에서 구형 계획 리뷰 거절 응답 복구의 task 수용 기준과 전용 검증을 만족한다.
19. R-M1·R-A1·R-A2 범위에서 최종 리뷰 거절 코드 문서 검사 추가의 task 수용 기준과 전용 검증을 만족한다.
20. R-A3·R-A4·R-A6 범위에서 리뷰 수정 상태 판독과 거절 상수 통합의 task 수용 기준과 전용 검증을 만족한다.
21. R-A5·R-A10 범위에서 리뷰 분류의 단일 읽기와 계약별 계산 분리의 task 수용 기준과 전용 검증을 만족한다.
22. R-A9·R-A11 범위에서 계획 리뷰 관점과 delta 기준의 정본 통합의 task 수용 기준과 전용 검증을 만족한다.
23. 새 변경은 한국어 브리프·커밋 규약과 관찰 가능한 테스트 단언을 지키고, 역할 TOML 생성본을 동기화하며 scripts/lib를 추적하지 않고 각 blueprint의 종단 npm run ci를 통과한다.
24. 코드 리뷰어는 적대적 자세로 반드시 수정할 것만 보고하며 `advisory`를 내지 않고, context-reviewer는 적대적 자세를 얻되 기존 보고 기준을 유지한다.
25. `review-dispatch` plan·execute는 commit task 수 ≥ 3 또는 `review_risk`가 비어 있지 않을 때 `reviewer_tier: strong`을 계산하고, 사용자 config `review.min_reviewer_tier`로 상향만 허용하며, `strong` 매핑이 있을 때만 모델에 적용하고 Claude 훅은 strong 매핑 모델로의 상향만 통과시킨다.

## Out of scope
- 이번 drive 후속 계획은 기존 closed blueprint를 재개하지 않으며, 이미 충족된 항목은 새 구현 대신 현재 코드·테스트 근거로 닫는다.
- gate가 나오는 계획 문서 형식 → `plan-workflow`
- legacy epic의 물리적 이관. 이 epic은 논리적 병합만 한다.
- legacy epic에 남은 미완료 blueprint는 모두 closed로 간주하고 상태를 바꾸지 않았다.

## Legacy epic 귀속
Epic 기능 분류의 매핑이다. △는 일부 blueprint가 다른 영역에 귀속된다는 뜻이다.

- [workflow-reliability](../workflow-reliability/index.md)
- [adaptive-review-dispatch](../adaptive-review-dispatch/index.md)
- [verification-reuse-checkpoint-compaction](../verification-reuse-checkpoint-compaction/index.md)
- [coding-standards-pr-retro](../coding-standards-pr-retro/index.md)

### 다른 epic에서 이 영역으로 귀속되는 blueprint
| legacy epic | blueprint | 이유 |
| --- | --- | --- |
| 004 | 007 context-review-guard | 리뷰 심사와 G18 |
| 009 | 006 debugger-agent | verify 실패 조사 |
| 018 | 018 gate-integrity | gate 집합과 verify 증적 |
| 061 | 001 | 셸 없는 검증, 커밋 스코프 검사 |
| 087 | 001 commit-enforcement | 커밋 강제력과 게이트 실패 조건 |
| 099 | 001 | 리뷰 입력 일관성 |

## Blueprints
- [doc-quality-gate-removal](blueprints/doc-quality-gate-removal/index.md) — plan gate의 문서 품질 코드(G10–G12·G18·G22·G25–G31)와 G14·G21 형식 메시지를 `validate-gates-*`에서 삭제하고 플러그인 문서를 맞춘다.
- [composite-gate-output](blueprints/composite-gate-output/index.md) — `validate` 실패를 복합 gate 7개(`gates[]`)로 요약하고 commit·coordinator·hook의 경계 거절 reason에 같은 gate 이름을 붙인다.
- [final-review-brief-compliance](blueprints/final-review-brief-compliance/index.md) — `review_contract: brief` blueprint의 최종 리뷰를 브리프 이행 판정 2관점으로 줄이고, 브리프 위반에 한해 리뷰 원인 repair 1회와 delta 1회를 `review-record`·`coordinator-repair`·`coordinate-next`에 허용한다.
- [drive-review-compatibility](blueprints/drive-review-compatibility/index.md) — 리뷰 거절 응답 호환성과 설명 계약 복구; R-M1·R-M3·R-A1·R-A2·R-A7·R-A8 처리.
- [review-contract-deduplication](blueprints/review-contract-deduplication/index.md) — 리뷰 계약 판정의 중복 제거; R-A3·R-A4·R-A5·R-A6·R-A9·R-A10·R-A11 처리.
- [adversarial-review-tiering](blueprints/adversarial-review-tiering/index.md) — 리뷰어를 적대적 자세와 필수 수정 보고 기준으로 개정하고, 규모·위험으로 reviewer_tier를 계산해 모델에 적용하며 훅이 상향만 허용한다.
