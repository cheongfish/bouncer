---
type: bouncer.blueprint
title: Graphify 추천 payload 상한
description: Bounds Graphify traversal and returns compact deterministic source and test suggestions.
resource: .bouncer/context/epics/072-search-payload-context-retention/blueprints/001-graphify-compact-payload/index.md
tags:
  - bouncer
  - blueprint
  - graph-suggest
  - ranking
  - traversal
  - payload
timestamp: '2026-09-17T09:36:57.010+09:00'
bouncer:
  id: '001'
  epic_id: '072'
  blueprint_id: '001'
  status: closed
  commit_type: feat
  scale: full
  supersedes: []
---
# Graphify 추천 payload 상한

Epic: [072](../../index.md)

## Intent

`graph-suggest`의 탐색량과 기본 후보 수를 고정하고 상세 진단은 명시한 debug 호출에만 제공함. 기존 source/test-only, low-confidence와 사용자 범위 확정 계약을 유지함.

## Contract

- 인터페이스: `bouncer graph-suggest --query <text> [--seed <value>]... [--debug]`를 제공한다. 기본 JSON은 `status`, `confidence`, 역할별 compact `candidates`, `suggested_paths`, 짧은 `reasons` code를 반환하고, `--debug`는 같은 계산의 상세 후보·근거·traversal 통계를 `debug` 아래에 추가한다.
- 데이터·상태: 기본 후보는 역할별 3개, 전체 8개다. implementation은 score 4 이상, test는 implementation 연결이 확인된 파일만 남긴다. seed별 file fan-out은 8, BFS frontier는 32, depth는 2다. 후보 basis는 문서화된 폐쇄형 enum의 24자 이하 ASCII code이고 reason은 중복 없는 안정 code이며, 같은 점수는 role과 path로 정렬한다.
- 수용 기준: Epic success criteria 1–4와 12가 참이다. `--debug`를 빼거나 넣어도 기본 필드는 byte-for-byte 같고 graph의 node·link 배열 순서를 바꿔도 기본 결과가 같다.
- 검증 명령: 구현 task는 확정한 task verify 명령을 사용하고 terminal verification node는 `npm run ci`를 실행한다.
- 실패 모드·엣지 케이스: generic-only, seed fan-out 초과, frontier 초과, 구현 후보 부재와 구현 후보 전부 low는 `low-confidence`와 빈 `suggested_paths`를 반환한다. source graph 부재·손상은 기존 `unavailable` 계약을 지키고 test graph 부재는 구현 ranking을 유지한 채 reason code를 남긴다. path seed는 generic 단어 필터로 버리지 않는다.

## Out of scope

- intent command lazy loading과 resolver payload 변경
- finalize retention audit와 legacy 문서 삭제
- `scripts/lib/*.js` 추적 제거 또는 배포 방식 변경
- context graph와 context candidate 복구
- Graphify 외부 package, graph schema와 build freshness 변경
- Graphify 후보로 `affected_paths`를 자동 작성하는 동작

## One-commit justification

- traversal 예산, ranking 후 필터, compact/debug 직렬화와 소비 문서는 하나의 공개 `graph-suggest` 응답 계약을 구현하므로 한 reviewable commit으로 묶는다. 전체 CI는 source diff가 없는 verification node가 fan-in 뒤 실행한다.

## Documents
* [Tasks](tasks/001/tasks.md) - 구현 브리프
* [Verification](tasks/001/verification.md) - 검증 명령과 증적
* [Review](tasks/001/review.md) - 리뷰 발견사항
* [Terminal verification task](tasks/002/tasks.md) - 통합 checkout 전체 CI 브리프
* [Terminal verification evidence](tasks/002/verification.md) - 전체 CI 증적
* [Context review](context-review.md) - 계획 문서 정합성 판정
