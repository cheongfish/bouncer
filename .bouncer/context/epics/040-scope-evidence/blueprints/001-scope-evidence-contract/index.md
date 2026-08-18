---
type: bouncer.blueprint
title: 범위 판단 근거 계약 전환
description: Blueprint 001
resource: .bouncer/context/epics/040-scope-evidence/blueprints/001-scope-evidence-contract/index.md
tags:
  - bouncer
  - blueprint
timestamp: '2026-08-18T08:58:48.535+09:00'
bouncer:
  id: '001'
  epic_id: '040'
  blueprint_id: '001'
  status: approved
  commit_type: feat
  scale: full
---
# 001 scope-evidence-contract

Epic: [040](../../index.md)

## Intent
- 문제: `graph`라는 구현 이름이 범위 판단 근거의 정본처럼 보이고, Graphify 결과와 승인 범위의 경계가 흐리다.
- 완료 조건: `scope_evidence`를 정본 쓰기 형식으로 만들고, 구 형식은 읽기 호환으로만 유지한다.

## Contract
- 인터페이스: task frontmatter의 정본은 `bouncer.scope_evidence`다. 이 객체는 `generated_at`, `producer`, `suggested_paths`, `basis`를 가지며 `producer: graphify`와 현재 basis entry 계약을 지원한다.
- 데이터·상태: 새 scaffold와 Graphify runner는 `scope_evidence`만 쓴다. 읽기 경로는 `scope_evidence`가 있으면 이를 우선하고, 없을 때만 구 `graph`를 같은 내부 표현으로 정규화한다. 둘이 함께 있으면 실패시켜 모호한 계획을 막는다.
- 수용 기준: S9와 G4는 하나의 정규화·검증 helper를 공유하고, 새 형식·구 형식·두 형식 충돌을 테스트한다. `suggested_paths`는 후보이며 `affected_paths`를 자동으로 바꾸지 않는다.
- 검증 명령: `npm test`
- 실패 모드·엣지 케이스: Graphify 비활성, source/context graph 누락·실패도 비어 있지 않은 basis 상태로 기록한다. 새 형식에 필수 필드가 없거나 producer가 허용값 밖이면 S9/G4가 실패한다.

## Out of scope
- `graphify.enabled`, graph-sync, Graphify query 형식, `.bouncer/config.json`은 변경하지 않는다.
- `code_search` 등 새 producer나 evidence 자동 병합은 추가하지 않는다.

## One-commit justification
- 런타임 계약 변경과 그 계약을 설명·생성하는 문서 표면을 두 task로 닫되, 둘은 같은 공개 스키마 전환을 완성한다.

## Documents
* [Tasks](tasks/001/tasks.md) - 구현 브리프
* [Verification](tasks/001/verification.md) - 검증 명령과 증적
* [Review](tasks/001/review.md) - 리뷰 발견사항
* [Context review](context-review.md) - 계획 문서 정합성 판정
<!-- explain.md는 plan scaffold에 포함되지 않습니다. /bouncer-finalize가 작성합니다. -->
