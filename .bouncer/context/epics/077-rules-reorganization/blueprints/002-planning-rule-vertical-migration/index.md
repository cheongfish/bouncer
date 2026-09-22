---
type: bouncer.blueprint
title: 계획 규칙과 문서 스키마 수직 이전
description: Moves planning policy and document schema to consumer-aligned canonical rules without changing workflow behavior.
resource: .bouncer/context/epics/077-rules-reorganization/blueprints/002-planning-rule-vertical-migration/index.md
tags:
  - bouncer
  - blueprint
  - planning
  - document-schema
  - rule-ownership
timestamp: '2026-09-22T14:18:32.374+09:00'
bouncer:
  id: '002'
  epic_id: '077'
  blueprint_id: '002'
  status: closed
  commit_type: refactor
  scale: full
  supersedes: []
---
# 002 계획 규칙과 문서 스키마 수직 이전

Epic: [077](../../index.md)

## Intent
- 계획 단계가 실행·coordinator 계약까지 담은 `rules/governance.md` 전체와 이름이 불분명한 schema 정본을 함께 읽는 결합을 제거함.
- 계획 정책과 문서 schema를 소비자 경계에 맞는 정본으로 옮기고 기존 scaffold·gate 동작을 보존함.

## Contract
- 인터페이스: `rules/planning.md`가 Blueprint 크기, light/full, 초기 DAG·승인 scope와 범용 epic 명명을 소유하고 `rules/document-schema.md`가 계획 문서 frontmatter와 task bundle 계약을 소유한다. `plan`, `init`, spec-authoring은 판단 직전에 필요한 정본을 참조하고 template·scaffold 산출물은 같은 계약을 유지한다.
- 데이터·상태: OKF 및 `bouncer.*` 필드 의미, scaffold 산출물, gate code, runtime 상태는 바뀌지 않는다. BP01 ownership 표의 BP2 행은 새 정본과 소비자를 가리키며 `rules/governance.md`에는 BP3·BP4 소유 내용만 남는다.
- 수용 기준: Epic 성공 조건 6–9가 충족되고 BP2 규범의 옛 경로 중복과 stale reference가 없으며 characterization 검사가 새 위치에서 같은 계약을 확인한다.
- 검증 명령: 전체 검증은 `npm run ci`로 수행한다.
- 실패 모드·엣지 케이스: BP3 소유 실행 문장을 함께 이동하거나 light→full 복귀, verification node, 20-path warning의 의미가 달라지면 실패다. TypeScript 원본과 생성 JavaScript의 template 주석이 어긋나거나 schema 이전 뒤 `rules/okf.md` 참조가 활성 소비자에 남아도 실패다.

## Out of scope
- coordinator·run·execute·commit·finalize의 실행 계약과 동적 scope 의미를 옮기지 않는다.
- `rules/governance.md`를 삭제하거나 공개 workflow 등급, 배포 목록과 사용자 문서를 BP04 최종 형태로 정리하지 않는다.
- CLI 상태 전이, gate code, runtime config, dependency와 scaffold 출력 형태를 바꾸지 않는다.
- 동결된 `rules-reorganization-proposal.md`를 수정하거나 commit하지 않는다.

## One-commit justification
- planning 계약 이전과 schema 경로 전환은 같은 load graph의 연속 단계다. 두 task commit으로 회귀 지점을 분리하되 하나의 PR에서만 중복 정본 없이 전환할 수 있다.

## Documents
* [Tasks](tasks/001/tasks.md) - 구현 브리프
* [Verification](tasks/001/verification.md) - 검증 명령과 증적
* [Review](tasks/001/review.md) - 리뷰 발견사항
* [Tasks 002](tasks/002/tasks.md) - 문서 schema 정본과 소비자 경로 전환
* [Verification 002](tasks/002/verification.md) - schema 이전 검증 명령과 증적
* [Review 002](tasks/002/review.md) - schema 이전 리뷰 발견사항
* [Context review](context-review.md) - 계획 문서 정합성 판정
