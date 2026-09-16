---
type: bouncer.blueprint
title: 터미널 의도 provenance 종단 검증
description: Verifies the code-grounded intent workflow across Git commits, Explain provenance, and source/test Graphify.
resource: .bouncer/context/epics/071-code-grounded-intent-provenance/blueprints/005-terminal-verification/index.md
tags:
  - bouncer
  - blueprint
  - e2e
  - intent-provenance
  - git
  - graphify
timestamp: '2026-09-16T21:52:33.191+09:00'
bouncer:
  id: '005'
  epic_id: '071'
  blueprint_id: '005'
  status: closed
  commit_type: test
  scale: full
  supersedes: []
---
# 터미널 의도 provenance 종단 검증

Epic: [071](../../index.md)

## Intent

Epic 071의 네 선행 Blueprint가 만든 계약을 임시 Git 저장소의 한 종단 시나리오로 연결해 배포 CLI 경계에서 회귀를 검출한다. 함수 candidate 선택, stable Task provenance, 후속 intent freshness와 source/test Graphify를 확인한 뒤 전체 CI 증적을 남긴다.

## Contract

- 인터페이스: 새 공개 제품 인터페이스는 없다. Node test runner가 발견하는 임시 저장소 기반 종단 회귀를 추가한다.
- 데이터·상태: 실제 checkout과 사용자 Git 설정은 바꾸지 않는다. 테스트가 만든 저장소, Bouncer 문서, commit과 graph 산출물은 테스트별 임시 디렉터리에만 존재한다.
- 수용 기준:
  1. 동명 함수 조회가 `ambiguous`와 둘 이상의 opaque `candidate_ref`를 반환하고, 선택한 ref의 함수만 이어서 처리한다.
  2. 첫 Task commit의 stable Task ID가 trailer와 Explain 행에서 일치하며 Explain SHA는 소문자 8자리다.
  3. resolver가 같은 commit을 소문자 40자리 좌표로 반환한다.
  4. 후속 Task commit이 같은 함수를 바꾸면 첫 candidate는 `possibly-superseded`, 후속 candidate는 `current`다.
  5. Plan 전제 점검과 SessionStart 실행 뒤 context graph 경로가 없고 graph 동기화 결과는 source·test 두 scope뿐이다.
  6. 전체 `npm run ci`가 통과한다.
- 검증 명령: 구현 task는 사용자가 확정한 task verify 명령을 사용하고, 종단 verification node는 `npm run ci`를 실행한다.
- 실패 모드·엣지 케이스:
  - 현재 후보에 없는 candidate ref는 다른 함수를 고르지 않고 조회 실패로 끝난다.
  - 전역 Git 사용자 설정과 signing 설정이 없어도 fixture commit이 재현된다.
  - Graphify 실행 파일이 외부 설치나 네트워크를 요구하지 않으며 source·test 외 scope를 보고하면 실패한다.
  - 어느 단계든 실패하면 ambiguous 선택, trailer, SHA 길이, freshness 또는 graph scope 중 깨진 계약이 assertion에 드러난다.

## Out of scope

- BP 001~004가 확정한 제품 동작과 공개 CLI 계약 변경
- context graph, `context-search`, `scope_evidence`, G4 또는 S9 복구
- Graphify payload 축소, intent lazy loading, context retention과 coordinator 병렬화
- 기존 단위 테스트 통합이나 과거 Explain·commit 일괄 변환

## One-commit justification

- 구현 diff는 하나의 종단 회귀 테스트 파일로 닫히며 제품 source를 바꾸지 않는다. 전체 CI는 별도 verification node가 실행하므로 reviewable commit에는 테스트 계약만 남는다.

## Documents
* [Tasks](tasks/001/tasks.md) - 구현 브리프
* [Verification](tasks/001/verification.md) - 검증 명령과 증적
* [Review](tasks/001/review.md) - 리뷰 발견사항
* [Terminal verification task](tasks/002/tasks.md) - 통합 checkout 전체 CI 브리프
* [Terminal verification evidence](tasks/002/verification.md) - 전체 CI 증적
* [Context review](context-review.md) - 계획 문서 정합성 판정
