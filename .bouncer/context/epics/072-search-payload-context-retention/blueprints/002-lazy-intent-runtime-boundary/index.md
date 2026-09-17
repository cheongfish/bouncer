---
type: bouncer.blueprint
title: Intent 런타임 지연 적재 경계
description: Loads intent parsing and provenance only when the intent command executes while preserving its public contract.
resource: .bouncer/context/epics/072-search-payload-context-retention/blueprints/002-lazy-intent-runtime-boundary/index.md
tags:
  - bouncer
  - blueprint
  - intent
  - cli
  - lazy-loading
  - commonjs
timestamp: '2026-09-17T12:35:11.204+09:00'
bouncer:
  id: '002'
  epic_id: '072'
  blueprint_id: '002'
  status: closed
  commit_type: feat
  scale: full
  supersedes: []
---
# Intent 런타임 지연 적재 경계

Epic: [072](../../index.md)

## Intent

일반 CLI 호출이 함수 provenance 구현을 미리 적재하지 않고 `bouncer intent`를 실행할 때만 관련 모듈을 적재하도록 런타임 경계를 분리함. 기존 intent 상태, JSON, 종료 코드와 Node.js 배포 계약을 그대로 유지함.

## Contract

- 인터페이스: 공개 명령은 `bouncer intent --symbol <function-name> [--candidate <qualified-ref>] [--limit <1..5>] [--repo <dir>]`를 유지한다. help의 명령 순서와 usage 문구도 바꾸지 않는다.
- 데이터·상태: CLI 모듈을 require하거나 help, init, graph-sync, graph-suggest와 다른 일반 명령을 실행한 상태의 CommonJS module cache에는 `symbol-index`와 `intent-provenance`가 없다. 유효한 `intent` dispatch가 전용 parser와 handler를 적재한 뒤 두 구현 모듈이 cache에 나타난다.
- 수용 기준: Epic success criteria 5, 6, 10, 11, 12가 참이다. 기존 intent fixture의 `resolved`, `ambiguous`, `unresolved`, `unlinked` payload와 exit code assertion이 그대로 통과한다.
- 검증 명령: 구현 task의 명령은 사용자 확인 뒤 확정하고, terminal verification node는 저장소 루트에서 `npm run ci`를 실행한다.
- 실패 모드·엣지 케이스: 값이 없거나 중복된 option은 resolver를 호출하지 않고 exit 2로 끝난다. Git·filesystem 조회와 발급되지 않은 candidate ref 오류는 부분 JSON 없이 stderr와 exit 1을 유지한다. lazy require 실패는 상태 payload로 위장하지 않는다. TypeScript와 생성 CommonJS가 달라지면 `check:emit`이 실패한다.

## Out of scope

- `symbol-index`의 함수 인식과 source/generated 분류 알고리즘 변경
- `intent-provenance`의 Git, trailer, Explain 연결과 freshness 계산 변경
- intent JSON field, status, body byte limit와 exit code 변경
- Graphify ranking, context retention과 legacy 문서 삭제
- `scripts/lib/*.js`의 Git 추적 제거 또는 TypeScript runtime 도입

## One-commit justification

- 전용 command 추출, lazy dispatch와 module-cache 회귀는 하나의 적재 경계를 구성하며 공개 동작을 바꾸지 않는 단일 reviewable commit이다. 전체 CI는 source diff가 없는 terminal verification node가 통합 뒤 실행한다.

## Documents
* [Tasks](tasks/001/tasks.md) - 구현 브리프
* [Verification](tasks/001/verification.md) - 검증 명령과 증적
* [Review](tasks/001/review.md) - 리뷰 발견사항
* [Terminal verification task](tasks/002/tasks.md) - 통합 checkout 전체 CI 브리프
* [Terminal verification evidence](tasks/002/verification.md) - 전체 CI 증적
* [Context review](context-review.md) - 계획 문서 정합성 판정

