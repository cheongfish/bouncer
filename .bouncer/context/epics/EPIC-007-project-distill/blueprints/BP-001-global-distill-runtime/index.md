---
type: bouncer.blueprint
title: 프로젝트 Distill 런타임 연결
description: Blueprint BP-001
resource: .bouncer/context/epics/EPIC-007-project-distill/blueprints/BP-001-global-distill-runtime/index.md
tags:
  - bouncer
  - blueprint
timestamp: '2026-08-03T04:59:09.997Z'
bouncer:
  id: BP-001
  epic_id: EPIC-007
  blueprint_id: BP-001
  status: approved
  commit_type: feat
---
# BP-001 global-distill-runtime

Epic: [EPIC-007](../../index.md)

## Intent
- 문제: Distill이 BP에 갇혀 다음 사이클 입력이 되지 않고, finalize allowed-set도
  blueprint dir 밖 전역 파일을 거부한다.
- 완료 조건: `.bouncer/context/Distill.md`가 init으로 생기고, 마스터 룰·plan/
  execute가 읽으며, finalize가 승격·커밋을 허용한다. Epic 성공 기준 1–6.

## Contract
- 인터페이스 (경로): 전역 Distill SSOT는 `.bouncer/context/Distill.md`
  (`layout.PROJECT_DISTILL`). 마스터 룰·스킬·init/finalize가 이 문자열만 쓴다.
- 인터페이스 (init): 최초 init과, 이미 초기화된 저장소에 파일이 없을 때 골격만
  생성. 기존 파일은 덮어쓰지 않는다. `inspectBootstrap` 판정 기준은
  `config.json` 불변.
- 인터페이스 (finalize/commit-guard): `makeAllowed`가 전역 Distill 경로를
  blueprint dir·epic index·context index와 같이 항상 허용한다.
- 인터페이스 (문서 골격): `## Invariants` / `## Gotchas` / `## Decisions`.
  Decisions는 **현재 유효 결정만**(변동 로그 append 금지). BP `distill.md`는
  사이클 후보로 유지.
- 인터페이스 (스킬): plan/execute preflight에서 전역 Distill Read; finalize는
  BP distill 작성 후 durable만 전역으로 승격·교체·폐기; spec-authoring에 작성
  규칙; 마스터 룰은 경로+읽기 의무만.
- 데이터·상태: 새 OKF kind/G9 본문 검사 없음. BP distill status 머신 유지.
- 수용 기준: Epic Success criteria 1–6.
- 검증 명령: `npm test`
- 실패 모드·엣지 케이스: 전역 파일 없음 → plan/execute가 존재 확인 후 없으면
  init/시드 안내; 기존 Distill 있음 → init이 내용 보존; affected_paths에 없어도
  finalize가 Distill 변경을 허용.

## Out of scope
- G9를 전역 Distill 본문 품질 게이트로 확장.
- `bouncer.distill` 스키마를 전역 파일에 재사용하거나 BP distill 제거.
- EPIC-005/006 문서 소급 정리, 루트 에이전트 규약 파일 병합.

## One-commit justification
- 전역 파일이 있어도 finalize가 거부하면 루프가 닫히지 않고, 스킬만 있으면
  커밋 가드가 막는다. init·allowed-set·룰·스킬·테스트는 한 커밋의 동일 계약이다.
- 게이트/스키마를 건드리지 않으므로 회귀 범위는 init/finalize와 문서 계약
  테스트로 한정된다.

## Documents
* [Tasks](tasks.md) - 구현 브리프
* [Verification](verification.md) - 검증 명령과 증적
* [Review](review.md) - 리뷰 발견사항
* [Distill](distill.md) - 배운 것
