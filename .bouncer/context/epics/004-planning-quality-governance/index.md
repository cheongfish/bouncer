---
type: bouncer.epic
title: 004 planning-quality-governance
description: '계획 수립 가드레일, 리뷰 루브릭, 검증 래퍼, 컨텍스트 리뷰 및 스킬 문서 품질 결함을 통합 관리'
resource: .bouncer/context/epics/004-planning-quality-governance/index.md
tags:
  - bouncer
  - epic
timestamp: '2026-08-02T23:44:38.453Z'
bouncer:
  id: '004'
  epic_id: '004'
  status: approved
---
# 004 planning-quality-governance

계획 수립 가드레일, 리뷰 루브릭, 검증 래퍼, 컨텍스트 리뷰 및 스킬 문서 품질 결함 역사를 하나의 계획·품질 거버넌스 계층으로 통합 관리한다.

## Blueprints
* [001 spec-authoring-guardrails](blueprints/001-spec-authoring-guardrails/index.md) - blueprint·tasks 템플릿 본문에 Contract-First 가드레일과 수용 기준·검증 항목을 추가한다
* [002 init-rules-scaffold](blueprints/002-init-rules-scaffold/index.md) - `bouncer init`이 게이트 밖 구간을 안내하는 규칙 파일을 함께 스캐폴딩한다
* [003 per-task-verify-command](blueprints/003-per-task-verify-command/index.md) - 전역 `config.verify` 하나 대신 블루프린트 단위 검증 명령을 선언·실행하고 증적에 남긴다
* [004 discovery-depth](blueprints/004-discovery-depth/index.md) - `discovery`가 엣지·실패 모드·기존 스트림 중복까지 한 패스에서 묻고 그 산출을 plan에 넘기게 한다
* [005 reviewer-prompt](blueprints/005-reviewer-prompt/index.md) - review 루브릭·reviewer-prompt·execute dispatch 계약을 한 커밋으로 넣는다
* [006 plan-verify-detection](blueprints/006-plan-verify-detection/index.md) - plan에 빌드 스크립트 감지·검증 명령 제안 단계를 추가하고 래퍼 패턴을 문서화한다 (`skills/bouncer-plan`, `docs/configuration.md`, 계약 테스트)
* [007 context-review-guard](blueprints/007-context-review-guard/index.md) - context-review 문서·스킬·에이전트 신설과 G18 plan 게이트, minimality 래더 정렬, 인젝션 신뢰 경계 — `scripts/src/lib/{schema,paths,scaffold,validate,cli,init}.ts`·`skills/`·`agents/`·`docs/`
* [008 plan-explain-execute-fixes](blueprints/008-plan-explain-execute-fixes/index.md) - plan의 다중 task 절차와 graphify 안내, explain-diff 모순, 경량 리뷰 정책, 코드펜스 정렬을 `skills/**`·`rules/governance.md`·`docs/**`·`test/**`에서 고침
