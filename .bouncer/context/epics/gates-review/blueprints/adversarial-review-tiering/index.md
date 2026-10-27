---
type: bouncer.blueprint
title: 적대적 리뷰와 리뷰어 등급 자동 상향
description: 코드 리뷰는 적대적이되 반드시 고칠 것만 보고하게 하고, 규모·위험에 따라 리뷰어 등급을 계산해 훅이 상향만 허용하게 한다.
resource: .bouncer/context/epics/gates-review/blueprints/adversarial-review-tiering/index.md
tags:
  - bouncer
  - blueprint
timestamp: '2026-10-27T11:04:47.460+09:00'
bouncer:
  id: adversarial-review-tiering
  epic_id: gates-review
  blueprint_id: adversarial-review-tiering
  status: closed
  order: 20
  commit_type: feat
  scale: full
  review_scope: blueprint
  verification_policy: scoped_terminal
  review_contract: brief
  attribution: '리뷰 적대화와 리뷰어 등급 계산: gate·리뷰 판정 소유'
  supersedes: []
---
# adversarial-review-tiering

Epic: [gates-review](../../index.md)

## Intent
- 문제: 리뷰어가 "모든 실제 이슈를 라벨만 붙여 보고"하는 기준이라 반드시 고칠 것과 취향성 제안이 섞이고, 리뷰어 모델은 역할별 고정값이라 복잡한 계획과 단순한 계획이 같은 등급으로 읽힌다. 실측(plan 재생)에서 Sonnet은 복잡한 계획의 반드시 고칠 minor를 약 1/3 놓쳤다.
- 완료 조건: 코드 리뷰어는 적대적 자세로 "반드시 수정할 것만" 보고하고, context-reviewer는 적대적 자세를 얻는다. `review-dispatch` plan·execute가 `reviewer_tier`를 계산해 모델에 적용하고, Claude 훅은 상향만 허용한다.

## Contract
- 인터페이스: `review-dispatch` plan·execute 성공 payload의 새 필드 `reviewer_tier`(`standard` | `strong`)와 `reviewer_tier_applied`(boolean). `bouncer subagent-model`의 새 플래그 `--tier <strong|standard|light>`. config 키 `review.min_reviewer_tier`(`standard` | `strong`, 부재 가능).
- 데이터·상태: 계산 규칙은 아래와 같다. `reviewer_tier = strong` ⇔ commit task 수 ≥ 3(blueprint 범위 리뷰만 해당) 또는 해당 범위 `review_risk` 합집합이 비어 있지 않음. 그 외 `standard`. `review.min_reviewer_tier`가 있으면 둘 중 높은 쪽을 쓴다(상향만). 모든 관점은 같은 등급을 쓴다. 등급 적용은 `reviewer_tier`가 `strong`이고 `model_tiers.<provider>.strong` 매핑이 있을 때만 일어나며, 이때 slot보다 우선한다. `standard`이거나 매핑이 없으면 기존 slot/roles 해석을 그대로 쓰고 `reviewer_tier_applied: false`로 남긴다(`standard`는 역할의 기존 설정이 기본이라 slot을 낮추지 않는다).
- 수용 기준: epic Success criteria 24(리뷰어 보고 기준)와 25(등급 계산·적용)가 참이다. 코드 리뷰어 문서에는 `advisory` 출력 지시가 없고, context-reviewer 문서에는 `nit` 보고 기준이 남는다.
- 검증 명령: 각 task는 자기 테스트만, 종단 task는 `npm run ci`.
- 실패 모드·엣지 케이스: 임계값 경계는 commit task 2개(standard)와 3개(strong), `review_risk: []`(standard)와 `[public_interface]`(strong)다. `review.min_reviewer_tier`가 `light`나 오타면 dispatch가 `ok: false`로 거절하고 고칠 키 경로를 `next`로 알린다(하향 거부). `strong` 매핑이 없으면 다른 모델로 추측하지 않고 기존 해석으로 돌아가 `reviewer_tier_applied: false`를 남긴다. light 최초 계획 리뷰(`skip`)에는 reviewer가 없어 `reviewer_tier`가 없다. 훅은 Agent 입력 `model`이 `strong` 매핑 모델과 정확히 같을 때만 통과시키고, 하향·임의 모델은 기존대로 config 값으로 덮어쓴다.

## Out of scope
- frontmatter 등급 필드, 작성자 override, plan gate 거절 코드, `review-risk-missing` 경고 기준의 상향 조건.
- Codex `standard` 슬롯에 모델 ID를 채우는 일, `.bouncer/config.json`의 reviewer slot 이전(사용자 config).
- context-reviewer의 보고 기준 변경(`nit` 보고는 유지한다).
- delta 모드의 minor 제한 규칙, controller의 강등 규칙(`no-brief-clause`, `not-brief-violation`).
- `CHANGELOG.md`·버전 파일 갱신.

## One-commit justification
- 리뷰어 문서의 보고 기준과 등급 계산은 "리뷰어를 더 날카롭고 필요한 곳에만 비싸게 쓴다"는 한 계약이고, `reviewer_tier`가 훅과 문서까지 닿아야 효과가 있어 한 PR로 묶인다. 여섯 task 중 001·002·004는 서로 독립이고 003·005·006은 선행 task 뒤에 이어진다(002·003이 `test/cli-help.test.js`를 함께 고쳐 의존으로 순서를 잡는다).
