---
type: bouncer.blueprint
title: 워크플로 프롬프트 runtime contract
description: Consolidates workflow runtime authority while preserving commands, gates, consent points, and observable behavior.
resource: .bouncer/context/epics/069-workflow-improvement/blueprints/005-workflow-prompt-runtime-contract/index.md
tags:
  - bouncer
  - blueprint
  - workflow
  - runtime-contract
  - prompt-boundary
  - agent-authority
timestamp: '2026-09-15T10:20:06.944+09:00'
bouncer:
  id: '005'
  epic_id: '069'
  blueprint_id: '005'
  status: closed
  commit_type: feat
  scale: full
  supersedes: []
---
# 워크플로 프롬프트 runtime contract

Epic: [069](../../index.md)

## Intent

여섯 진입 skill과 다섯 agent brief가 CLI와 공통 규칙의 판정을 반복해 기본 실행 context가 커진다. 공통 runtime contract와 조건부 reference 경계를 고정하고 사용자 명령, gate, ACQ, 상태 전이와 결과 형식은 유지한다.

## Contract
- 인터페이스: `CLAUDE.md`와 plugin-root 적재 계약은 trust boundary, gate 우선, 사용자 승인, 실제 write cwd만 공통으로 제공한다. 여섯 진입 skill은 기존 번호 단계와 ACQ를 유지하고 CLI payload를 다음 행동의 입력으로 사용한다. 다섯 agent brief와 fallback dispatch는 역할별 authority input, write boundary, output schema를 같은 의미로 전달한다.
- 데이터·상태: 공개 CLI 인자와 JSON shape, 문서 frontmatter, pointer, coordinator ledger, gate code와 상태 enum을 바꾸지 않는다. 기존 payload 필드를 구조적으로 인용할 수는 있지만 새 제품 상태를 만들지 않는다.
- 수용 기준: Epic 성공 기준 16–22를 구조 테스트, agent 사본 exact-match, `npm run ci`로 판정한다.
- 검증 명령: 각 task는 소유한 구조 테스트를 실행하고, 두 축이 합쳐진 뒤 `npm run ci`를 실행한다.
- 실패 모드·엣지 케이스: reference를 옮겨도 번호 절차 앞에서 읽으면 축약으로 인정하지 않는다. ACQ, gate, pointer confirm-then-set, `affected_paths` 확인, light/full 예외, coordinator write 경계 중 하나라도 사라지면 구조 테스트가 실패해야 한다. generated TOML과 Markdown 정본이 다르거나 fallback이 더 약한 권한 경계를 받으면 agent 계약 실패로 처리한다. context-search, `scope_evidence`, G4/S9 제거는 후속 Blueprint 소관이므로 이번 변경에 섞지 않는다.

## Out of scope
- CLI, validator, gate code, 상태 전이, ACQ 시점과 compact 출력 shape 변경
- context-search, context graph, `scope_evidence`, G4와 S9 제거
- coordinator DAG, retry·repair budget, Explain·Quiz·PR 동작 변경
- 토큰 계측, 새 제품 상태, 새 호환 계층과 기존 context 문서의 소급 수정

## One-commit justification
- Blueprint는 하나의 프롬프트 소유권 정리 PR이다. runtime contract, 진입 skill, agent brief를 서로 검토 가능한 task 커밋으로 나누고 마지막 전체 CI에서 결합 상태를 판정한다.

## Documents
* [Task 001](tasks/001/tasks.md) - 공통 runtime contract와 안전 경계 정본
* [Task 002](tasks/002/tasks.md) - 여섯 진입 skill의 기본 적재 축약
* [Task 003](tasks/003/tasks.md) - 다섯 agent brief와 fallback authority 정합성
* [Context review](context-review.md) - 계획 문서 정합성 판정
