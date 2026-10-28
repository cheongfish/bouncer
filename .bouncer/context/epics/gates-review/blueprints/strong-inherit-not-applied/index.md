---
type: bouncer.blueprint
title: strong 매핑 inherit을 리뷰어 등급 미적용으로 보고
description: strong 매핑이 inherit이면 review-dispatch가 리뷰어 등급을 적용됨으로 보고하지 않고 미적용 사유를 남긴다.
resource: .bouncer/context/epics/gates-review/blueprints/strong-inherit-not-applied/index.md
tags:
  - bouncer
  - blueprint
timestamp: '2026-10-28T13:22:47.478+09:00'
bouncer:
  id: strong-inherit-not-applied
  epic_id: gates-review
  blueprint_id: strong-inherit-not-applied
  status: closed
  order: 22
  commit_type: fix
  scale: full
  review_scope: blueprint
  verification_policy: scoped_terminal
  review_contract: brief
  attribution: review-dispatch 리뷰어 등급 판정(reviewer_tier_applied) 수정이라 gate·검증·리뷰 판정 epic에 귀속
  supersedes: []
---
# strong 매핑 inherit을 리뷰어 등급 미적용으로 보고

Epic: [gates-review](../../index.md)

## Intent
strong 매핑이 `inherit`이면 `review-dispatch`는 리뷰어 등급을 적용됨으로 보고했지만, Claude 훅이 model 없는 리뷰어 호출을 slot 모델로 덮어써 실제로는 상향되지 않았다. 이 변경은 provider와 관계없이 `inherit` 매핑을 미적용(`tier-inherit`)으로 보고하고 모델 slug 매핑만 적용으로 보고하며, 훅 계약은 바꾸지 않는다.

## 배경
- 문제: `model_tiers.<provider>.strong`이 `"inherit"`이면 `review-dispatch`는 `reviewer_tier_applied: true`와 `model: null`을 보고한다. `bouncer init` 예시가 strong을 `"inherit"`로 두므로 기본 설정에서 "적용됨" 보고가 사실과 어긋난다.
- 완료 조건: strong 매핑이 `inherit`이면 provider와 관계없이 dispatch가 미적용과 그 사유를 보고하고, 실제 모델 slug 매핑만 적용으로 보고한다.

## Contract
- 인터페이스: `review-dispatch plan`·`execute` 성공 payload의 기존 필드 `reviewer_tier_applied`와 `reasons`의 의미가 바뀐다. 필드와 키 집합은 그대로다. 새 미적용 사유 문자열은 `reviewer tier strong not applied: tier-inherit (fix: model_tiers.<provider>.strong)`이고 `<provider>`는 해석된 provider 이름이다(예: `claude`, `codex`).
- 데이터·상태: `resolveSubagentRole({ tier: 'strong' })`가 `ok`, `source === 'tier'`, `model === null`(매핑 값 `inherit`)을 돌려주면 `agent_dispatch`는 등급 적용 전 해석(`baseDispatch`)을 그대로 두고 `reviewer_tier_applied: false`다. `model`이 문자열이면 지금처럼 매핑 결과로 바꾸고 `true`다. 파일·config 쓰기는 없다.
- 수용 기준: epic Success criteria 29.
- 검증 명령: commit task는 `node scripts/check-task.js test/review-dispatch.test.js test/subagents.test.js`, 종단 verification task는 `npm run ci`.
- 실패 모드·엣지 케이스: slot이 없고 strong이 `inherit`이면 `agent_dispatch.model`은 등급 적용 전과 같이 `null`이지만 `reviewer_tier_applied`는 `false`다. `reviewer_tier: standard`는 등급 해석을 부르지 않으므로 바뀌지 않는다. `tier-unmapped`·`provider-unknown` 미적용 사유와 `review-min-reviewer-tier-invalid` 거절은 그대로다. light skip 경로에는 tier 필드가 없다. 훅이 없는 provider(Codex·Cursor)에서 slot이 있고 strong이 `inherit`이면, controller가 false 경로의 일반 해석을 따르므로 리뷰어 모델이 부모 세션 상속에서 slot 모델로 바뀐다. 사용자가 모든 provider 적용을 선택하며 받아들인 의도된 결과다.

## Out of scope
- `hooks/subagent-model.js`의 모델 보정·strong 통과 계약 변경(선택지 2, 채택하지 않음).
- `bouncer subagent-model --tier` 응답과 `resolveSubagentRole`의 inherit 해석 변경.
- `bouncer init` 예시의 `model_tiers` 기본값 변경과 strong slug 지정 안내.
- RETRO-MODEL-TIERS-EFFORT.md 작업 2(coordinator 결함), 작업 3-2·3-3과 PR #288 advisory — 별도 blueprint로 계획한다.
- 작업 3-4 `codex-agents check` mismatch — 기본 비교 대상이 설치된 플러그인 캐시(0.1.12)이기 때문으로 확인됐고, `BOUNCER_HOME=<저장소>`로는 세 에이전트 모두 `in_sync: true`라 조치하지 않는다.
- `CHANGELOG.md`·버전 파일 갱신.

## One-commit justification
- 판정 함수 한 곳의 분기와 그 분기를 단언하는 테스트, 같은 판정을 서술하는 설정 문서 한 줄이 하나의 동작 변경이라 한 커밋에 들어간다.
