---
type: bouncer.blueprint
title: plan 세션 등급별 측정 기반
description: Record tier, model, and effort on every metrics session, add plan coordinator and planner session kinds, and restore the plan-review fixture under CI.
resource: .bouncer/context/epics/plan-workflow/blueprints/plan-session-metrics/index.md
tags:
  - bouncer
  - blueprint
  - metrics
  - model-tier
  - benchmark
timestamp: '2026-10-27T16:51:52.905+09:00'
bouncer:
  id: plan-session-metrics
  epic_id: plan-workflow
  blueprint_id: plan-session-metrics
  status: closed
  order: 36
  commit_type: feat
  scale: full
  review_scope: blueprint
  verification_policy: scoped_terminal
  review_contract: brief
  attribution: plan coordinator·planner 세션과 plan 리뷰의 등급별 측정 기반이라 bouncer-plan 단계 동작에 귀속
  supersedes: []
  prerequisites:
    - blueprint: .bouncer/context/epics/runtime-architecture/blueprints/model-tiers-effort
      merged_commit: 42bd048b62163cba9dd81a91b9619a92cdd48848
    - blueprint: .bouncer/context/epics/gates-review/blueprints/adversarial-review-tiering
      merged_commit: 7c6130600059eeddee877c7f62317444746c65a2
---
# plan-session-metrics

Epic: [plan-workflow](../../index.md)

## Intent
- `drive-metrics.json` 세션은 모델만 남기고 등급·effort를 남기지 않으며, plan coordinator·planner 세션을 담을 kind도 없어 plan coordinator 구조의 비용과 등급 효과를 지금 기준선과 비교할 수 없다.
- 모든 세션에 등급·effort를 기록하고 plan 세션 kind와 등급별 집계를 더하며, 깨진 plan-review fixture를 다시 실행 가능하게 해 CI에 넣는다.

## Contract
- 인터페이스: `metrics end`의 새 플래그 `--tier <strong|standard|light>`, `--effort <low|medium|high>`, `--blueprint <dir>`(plan kind 전용). `metrics start --kind`의 새 값 `plan-coordinator-session`, `planner-session`(이 둘만 `--blueprint` 생략 가능). `metrics summary` 성공 출력의 kind별 새 필드 `by_tier`.
- 데이터·상태: 세션에 `tier`, `effort`(각각 값 또는 `null`)를 저장한다. 플래그를 생략하면 `null`이다. plan kind 세션은 run coordinator 원장 snapshot(`start`/`end`)을 읽지 않고, blueprint 없이 시작하면 `blueprint: null`로 저장되어 `metrics end --blueprint`가 한 번만 채운다. `by_tier`는 `{ strong, standard, light, unknown }` 각각 `{ sessions, tokens_total, cost_total }`이며, `tier`가 `null`이거나 필드가 없는 옛 세션은 `unknown`으로 센다.
- 수용 기준: epic Success criteria 18(세션 등급 기록·plan kind·`by_tier`)과 19(fixture CI 복구)가 참이다.
- 검증 명령: 각 task는 자기 테스트만, 종단 task는 `npm run ci`.
- 실패 모드·엣지 케이스: 허용 밖 `--tier`/`--effort` 값, plan kind가 아닌 세션에 `end --blueprint`, 이미 blueprint가 있는 세션에 `end --blueprint`, blueprint 없이 시작한 plan 세션을 `--blueprint` 없이 끝내기는 모두 `invalid-metrics-input`으로 거절하고 파일을 바꾸지 않는다. Cursor처럼 effort를 적용하지 않았거나 `inherit`로 해석되어 등급이 없으면 플래그를 생략해 `null`로 남긴다. 리뷰어 dispatch가 `reviewer_tier_applied: true`면 상향된 `reviewer_tier`를 기록한다. 깨진 metrics 파일 거절과 context-review의 `target_digest` 규칙은 그대로다.

## Out of scope
- planner·plan coordinator 역할, plan ledger, coordinator 카드, `skills/bouncer-plan/SKILL.md` 재작성, `NAMED_AGENTS`·훅·init 템플릿 역할 추가 — 후속 blueprint(plan coordinator 본체)가 맡는다.
- 실측 실행과 `benchmarks/drive-serial-4/results.md` 기록.
- `coordinate worker-model`·`worker-tokens` 원장 기록과 `worker_tokens` 집계.
- `CHANGELOG.md`·버전 파일 갱신.

## One-commit justification
- 세션 등급 기록, 이를 넘기는 호출 문서, 측정 입력인 fixture는 "plan 단계 등급별 비용을 잴 수 있게 한다"는 한 목적이고 후속 blueprint의 측정 전제라 한 PR로 묶인다. 001(CLI)이 계약을 만들고 002(호출 문서)가 그 플래그를 쓰며, 003(fixture)은 독립이라 001과 병렬로 돈다.
