---
type: bouncer.epic
title: 116 plan-workflow
description: 'Plan workflow: discovery, scaffold, task briefs, light plans and plan gate rules'
resource: .bouncer/context/epics/plan-workflow/index.md
tags:
  - bouncer
  - epic
timestamp: '2026-10-20T16:05:56.272+09:00'
bouncer:
  id: plan-workflow
  epic_id: plan-workflow
  status: approved
  supersedes: []
---
# 116 plan-workflow

## Intent
- 문제: 기능 영역이 같은 작업이 legacy epic 63개에 흩어져 있고, 등록부 도입 뒤 이 저장소에는 새 blueprint를 만들 활성 epic이 없다.
- 목표: 이 epic이 `plan-workflow` 영역의 새 blueprint를 받는다. 포함: `/bouncer-plan`: 발견, spec-authoring, scaffold, task brief·intent bundle·경량 계획, plan gate와 context review의 계획 단계 규칙

## Success criteria
1. `plan-workflow` 영역에 속하는 새 계획은 이 epic 아래 blueprint로 만든다.
2. 아래 legacy epic은 `legacy`로 그대로 두고 조회·이력에만 쓴다. 승인·검증 해시와 trailer 연결을 바꾸지 않는다.
3. `bouncer.review_contract: brief` full blueprint의 `review-dispatch plan`은 `strategy: perspectives`와 관점 `consistency`·`scope_minimality`·`verifiability`·`risk_security`를 내고, `must_fix`가 있으면 수정 1회와 `combined` delta 1회를 거쳐 `context-review`가 닫힌다.
4. 새 light scaffold도 `review_contract: brief`를 쓰고 `context-review.md`를 만들며, 구조 검사 S38은 light의 표식을 거절하지 않는다. 표식 light는 `verifiability` 관점 리뷰를 받고, context review가 `accepted`가 아니면 `plan approve`가 거절한다.
5. 표식이 없는 blueprint는 full `single`/`combined`, light `skip`을 그대로 받고, 저장된 `single`·`clustered` payload와 legacy 관점 이름 기록이 계속 읽힌다. 표식 light의 run 최종 리뷰(관점·record·repair·G21)는 표식 없는 light와 같은 판정을 받는다.
6. light 문서 예산 100줄에서 `context-review.md`는 빠지고, CHANGELOG `[Unreleased]`에 항목이 있으며 `npm run ci`가 통과한다.

7. R-M2 범위에서 경량 계획 산출물 설명의 현행 계약 반영의 task 수용 기준과 전용 검증을 만족한다.
8. R-P1·R-P2·R-P3·R-P4 범위에서 계획 소비자 조사와 리뷰 판정 기준 명시의 task 수용 기준과 전용 검증을 만족한다.
9. R-P5 범위에서 선행 계획 병합 근거의 선언 형식 추가의 task 수용 기준과 전용 검증을 만족한다.
10. R-P5 범위에서 승인과 계획 게이트에 선행 병합 판정 연결의 task 수용 기준과 전용 검증을 만족한다.
11. 새 변경은 한국어 브리프·커밋 규약과 관찰 가능한 테스트 단언을 지키고, 역할 TOML 생성본을 동기화하며 scripts/lib를 추적하지 않고 각 blueprint의 종단 npm run ci를 통과한다.

12. review-compat-followups의 선행 형식 오류는 승인 쓰기 전 plan-approve-prerequisite으로 거절되고 모든 문서 bytes가 보존되며 선행 항목 판정이 일치한다.
13. review-compat-followups의 snapshot은 외부 디렉터리·파일을 쓰지 않고 I/O 실패를 reason으로 반환하며 partial merge 저장 순서·실패 무변경과 문서 heading 음수 회귀가 통과한다.
14. check-doc-shape 명시 문서 verify에 계약이 없으면 plan·draft가 같은 G20으로 거절하며 기존 argv·scoped_terminal 정책은 유지된다.
15. 이월된 reviewer·schema·intent·인계·snapshot 출처·review/finalize CLI 문서 및 CHANGELOG 누락이 현행 계약과 일치하고 역할 TOML parity가 통과한다.
16. 각 구현 task는 전용 검증을 사용하고 마지막 verification task는 전부 통합된 뒤 npm run ci를 수행한다. 한국어 브리프·커밋 규약과 비추적 scripts/lib 빌드 산출물 경계를 지킨다.
17. REQUIREMENTS_REVIEW_COMPAT_FOLLOWUPS.md는 모든 task의 변경·stage·커밋 및 finalize remainder에서 제외한다.

## Out of scope
- review-compat-followups는 closed 계획을 재개하지 않으며 요구사항 원본과 다른 로컬 제안 문서를 커밋하지 않는다.
- 이번 drive 후속 계획은 기존 closed blueprint를 재개하지 않으며, 이미 충족된 항목은 새 구현 대신 현재 코드·테스트 근거로 닫는다.
- 공통 리뷰 엔진과 execute·finalize 리뷰의 판정 기준·디스패치 → `gates-review`. 계획 작성의 소비자 조사·검증 가능성을 판정하는 plan context-review 기준은 이 epic에 포함한다.
- legacy epic의 물리적 이관. 이 epic은 논리적 병합만 한다.
- legacy epic에 남은 미완료 blueprint는 모두 closed로 간주하고 상태를 바꾸지 않았다.

## Legacy epic 귀속
Epic 기능 분류의 매핑이다. △는 일부 blueprint가 다른 영역에 귀속된다는 뜻이다.

- [planning-quality-governance](../planning-quality-governance/index.md) △
- [document-commit-contracts](../document-commit-contracts/index.md) △
- [task-brief-specificity](../task-brief-specificity/index.md)
- [code-grounded-intent-provenance](../code-grounded-intent-provenance/index.md)
- [task-intent-bundle-reuse](../task-intent-bundle-reuse/index.md)
- [plan-context-quality-efficiency](../plan-context-quality-efficiency/index.md)
- [plan-review-convergence](../plan-review-convergence/index.md)
- [intent-fence-guard](../intent-fence-guard/index.md)
- [plan-review-call-reduction](../plan-review-call-reduction/index.md)
- [plan-review-loop-guard](../plan-review-loop-guard/index.md)
- [drive-retro-104-followups](../drive-retro-104-followups/index.md) △

### 다른 epic에서 이 영역으로 귀속되는 blueprint
| legacy epic | blueprint | 이유 |
| --- | --- | --- |
| 043 | 002 light-plan-contract | 경량 plan |
| 063 | 002, 003, 004 | context review·발견 안내 |

## Blueprints
- [context-review-fix-restart](blueprints/context-review-fix-restart/index.md) — delta 뒤 열린 `must_fix` 대상 섹션을 고치면 `context-review restart`·`route`가 restart를 허용하고 skill 안내를 맞춘다.
- [plan-review-perspectives](blueprints/plan-review-perspectives/index.md) — `review_contract: brief` blueprint의 plan 리뷰를 full 4관점 병렬(`perspectives`)과 light `verifiability` 1관점으로 바꾸고 수정 1회·delta 1회로 닫는다.
- [drive-plan-quality](blueprints/drive-plan-quality/index.md) — 계획 영향 범위와 선행 병합 검증 강화; R-M2·R-P1·R-P2·R-P3·R-P4·R-P5 처리.

- [review-compat-followups](blueprints/review-compat-followups/index.md) — 승인 형식·snapshot 경계·verify 계약 보강과 이월 문서 모순 및 변경 이력 누락을 처리한다.
