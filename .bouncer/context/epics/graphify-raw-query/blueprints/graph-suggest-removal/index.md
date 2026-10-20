---
type: bouncer.blueprint
title: plan 그래프 흐름을 원본 Graphify 질의로 바꾸고 graph-suggest를 제거
description: Replace the plan-time graph-suggest ranking with raw Graphify anchor queries plus grep and remove the graph-suggest command.
resource: .bouncer/context/epics/graphify-raw-query/blueprints/graph-suggest-removal/index.md
tags:
  - bouncer
  - blueprint
  - graphify
  - plan
timestamp: '2026-10-15T10:07:37.437+09:00'
bouncer:
  id: graph-suggest-removal
  epic_id: graphify-raw-query
  blueprint_id: graph-suggest-removal
  status: closed
  order: 1
  commit_type: feat
  scale: full
  review_scope: blueprint
  supersedes: []
---
# plan 그래프 흐름을 원본 Graphify 질의로 바꾸고 graph-suggest를 제거

Epic: [100](../../index.md)

## Intent
plan이 초입에 그래프를 갱신하고 원본 Graphify 앵커 질의와 `grep -l`로 수정 대상 후보를 찾도록 바꿈. 후보를 내지 못하던 `graph-suggest` 명령과 구현·문서를 제거함.

## Contract
- 인터페이스:
  - 제거: `bouncer graph-suggest --query <text> [--seed <value>]... [--debug]` 명령. 이후 실행은 일반 unknown command(exit 2)다.
  - 변경: `graphify-runner` 반환은 per-graph sync basis(`graph`, `status`, `query`, `result`)와 후보 목록(경로 + 근거 한 줄)이다. `suggested_paths`·role `candidates`·`quality`는 없어진다.
  - 변경: plan은 preflight와 Project root 직후, 1단계 Discover 전에 `bouncer graph-sync`를 실행한다.
- 데이터·상태: task frontmatter는 바뀌지 않는다. 그래프 결과는 계속 frontmatter에 쓰지 않는다. `graphify-out/` 산출물 형식은 그대로다.
- 수용 기준: epic Success criteria 1~6.
- 검증 명령: `npm run ci` (TASKS-003).
- 실패 모드·엣지 케이스:
  - `GRAPHIFY_BIN`이 비었거나 source 그래프가 없거나 sync가 실패하면 basis에 상태를 남기고 plan을 계속한다. 소스 후보는 `rg` 기반으로 제시하고, "경로를 직접 입력하라"만 안내하지 않는다.
  - 앵커 질의가 "No matching nodes"이면 이름을 짐작해 다시 조회하지 않는다.
  - `query`가 `[!] TRUNCATED`이면 같은 앵커로 `--budget 3000` 1회만 재실행한다. `[i] Complete answer over budget`이면 재실행하지 않는다.
  - 레지스트리 맵·콜백 같은 간접 연결은 그래프에서 빠질 수 있으므로 export 영향 범위는 `rg`로 한 번 더 확인한다.
  - 아직 없는 새 파일은 Task 설명에 이름이 있을 때만 후보에 넣는다.

## Out of scope
- epic Out of scope 전부.
- `graph.basis`·`suggested_paths`를 담은 기존 테스트 fixture(`cli-validate`, `cli-verify`, `validate-hints`)는 과거 frontmatter 호환 입력이라 바꾸지 않는다.

## One-commit justification
- 문서 흐름 교체(TASKS-001)와 CLI 제거(TASKS-002)는 경로가 겹치지 않는 두 commit이다. 둘 다 반영돼야 "graph-suggest 문자열 0건"이 참이 되므로 한 PR로 묶는다.

## Documents
* [Tasks 001](tasks/001/tasks.md) - plan 문서 흐름 교체
* [Tasks 002](tasks/002/tasks.md) - graph-suggest CLI·구현 제거
* [Tasks 003](tasks/003/tasks.md) - 전체 CI 검증
* [Verification](tasks/001/verification.md) - 검증 명령과 증적
* [Review](review.md) - 리뷰 발견사항
* [Context review](context-review.md) - 계획 문서 정합성 판정
