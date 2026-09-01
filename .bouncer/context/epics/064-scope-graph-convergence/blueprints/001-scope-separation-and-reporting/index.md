---
type: bouncer.blueprint
title: 스코프 분리와 세 스코프 보고
description: Split the test scope out of source_dirs, always report a test scope entry from graph-sync, and remove the last root graphify-out/graph.json references.
resource: .bouncer/context/epics/064-scope-graph-convergence/blueprints/001-scope-separation-and-reporting/index.md
tags:
  - bouncer
  - blueprint
  - graph-scope
  - graph-sync
  - test-dirs
  - session-graph
timestamp: '2026-09-01T15:49:01.158+09:00'
bouncer:
  id: '001'
  epic_id: '064'
  blueprint_id: '001'
  status: closed
  commit_type: feat
  scale: full
  supersedes: []
---
# 001 scope-separation-and-reporting

Epic: [064](../../index.md)

## Intent
- 문제: 세 스코프를 만드는 코드는 완성돼 있는데 두 곳이 어긋나 있다. 이 저장소 config가 `test`를 `source_dirs`에 두어 test scope 자체가 안 생기고, `resolveGraphScopes`는 `graphify.test_dirs` 부재 시 `test` 항목을 보고에서 빼서 `graphify-runner`가 요구하는 basis 항목의 근거를 없앤다. 여기에 이미 삭제된 루트 `graphify-out/graph.json` 참조가 픽스처와 문서에 남아 있다.
- 완료 조건: 이 저장소가 test scope 그래프를 만들고 역할 분류가 실측으로 갈리며, `test_dirs`가 없는 config에서도 `graph-sync`가 `test` 항목을 사유와 함께 보고하고, 루트 `graph.json` 참조가 저장소에 없다.

## Contract
- 인터페이스: `planSessionGraph`/`bouncer graph-sync` 결과의 `graphs[]`는 언제나 `source`·`test`·`context` 세 항목을 담는다. `graphify.test_dirs`가 없거나 무효라 빌드할 수 없을 때 `test` 항목의 `action`은 새 값 `skip-unconfigured`이고 `reason`이 어느 경우인지 말한다. 그 항목의 나머지 필드는 `dirs: []`, `configured: []`, `outDir: 'graphify-out/test'`로 고정한다 — 존재하지 않는 입력을 있는 것처럼 싣지 않는다. `resolveGraphScopes`의 반환 배열도 같은 길이 셋으로 맞춘다. `missing`·경고 제외는 `graph.json` 존재 여부가 아니라 `action === 'skip-unconfigured'`를 키로 판정한다.
- 데이터·상태: `.bouncer/config.json`에서 `source_dirs`는 `["scripts", "hooks"]`, `graphify.test_dirs`는 `["test"]`가 된다. `graphify-out/test/graph.json`이 새 산출물로 생긴다(gitignore 대상).
- 수용 기준: epic 064 Success criteria 1~6.
- 검증 명령: `npm test`
- 실패 모드·엣지 케이스:
  - `test_dirs` 부재(`null`)와 `test_dirs: []`는 다른 상태다. 후자는 필드가 존재하므로 기존 `skip-no-dirs`를 유지하고 `skip-unconfigured`로 뭉개지 않는다.
  - `test_dirs`가 절대 경로나 `..` 탈출이면 값이 적용되지 않고 `skips`에 사유가 실린다. 그때도 `test` 항목은 `skip-unconfigured`로 보고하되 `reason`이 무효 사유를 가리켜야 하며, `skips` 줄을 대체하지 않는다.
  - `skip-unconfigured`는 빌드 대상이 아니고 `missing`에도 들어가지 않는다. 들어가면 `test_dirs`를 안 쓰는 모든 기존 프로젝트가 SessionStart마다 새 경고를 받는다.
  - 최상위 요약 집계가 깨진다. `planSessionGraph`는 `graphs.every((g) => g.action === 'skip-no-dirs')`로 `skip-no-dirs` 요약을 만드는데, 항상 실리는 `skip-unconfigured` 항목이 이 술어를 거짓으로 만들어 입력이 하나도 없는 저장소가 `skip-fresh`("graphs are up to date")로 보고된다. 집계는 `skip-unconfigured`를 제외한 뒤 판정해야 하고, 제외 후 남는 항목이 없을 때의 동작도 정해야 한다.
  - `test_dirs`를 쓰다가 지운 프로젝트에는 `graphify-out/test/graph.json`이 디스크에 남아 있다. 산출물이 있어도 `skip-unconfigured`를 유지해야 하며 `skip-fresh`나 빌드 대상이 되면 안 된다.
  - `NO_GRAPH_WORK`(graphify disabled·partial/legacy bootstrap·PATH 부재) 종료는 `graphs`가 빈 배열이다. 그 경로에 `test` 항목을 억지로 넣어 "시도했으나 없음"으로 오보하지 않는다.
  - `source_dirs`에서 `test`를 빼면 기존 `graphify-out/source` 그래프가 실제 입력과 어긋난다. source scope의 `watchFiles`에 `.bouncer/config.json`이 있으므로 다음 sync가 rebuild해야 하며, 이를 실측으로 확인한다.
  - 루트 `graphify-out/graph.json`을 쓰던 픽스처는 런타임 산출물 접두사 규칙을 검사한다. 경로를 바꾸되 그 규칙의 검사력이 줄지 않아야 한다.

## Out of scope
- `graph-search.ts`의 역할 점수·매칭 규칙 (epic 060 소관).
- `context-digest.ts`와 파생 앵커 (epic 063 소관).
- `bouncer init`이 기존 config에 `test_dirs`를 주입하도록 바꾸는 것.
- `.bouncer/config.json`의 `source_dirs`·`test_dirs` 외 필드.
- 사용자 전역 `/graphify` 스킬과 전역 지침.

## One-commit justification
- 세 task는 같은 계약의 생산자와 소비자다. task 001이 `test` 항목을 항상 보고하게 만들어도 task 002가 이 저장소 config를 안 바꾸면 그 항목은 영원히 `skip-unconfigured`뿐이라 실측 증거가 안 나오고, 002만 먼저 머지하면 `test_dirs`를 안 쓰는 소비 프로젝트의 보고 구멍이 그대로 남는다. task 003은 같은 "정본 경로는 스코프 그래프"라는 진술을 픽스처와 설치 문서에서 마무리하는 조각이라, 셋을 한 PR로 봐야 스코프 계약이 한 번에 리뷰된다.

## Documents
* [Tasks 001](tasks/001/tasks.md) - 세 스코프 보고 계약
* [Tasks 002](tasks/002/tasks.md) - 저장소 config 전환과 역할 분류 실측
* [Tasks 003](tasks/003/tasks.md) - 루트 graph.json 참조 정리
* [Verification 001](tasks/001/verification.md) - 검증 명령과 증적
* [Review 001](tasks/001/review.md) - 리뷰 발견사항
* [Verification 002](tasks/002/verification.md) - 검증 명령과 증적
* [Review 002](tasks/002/review.md) - 리뷰 발견사항
* [Verification 003](tasks/003/verification.md) - 검증 명령과 증적
* [Review 003](tasks/003/review.md) - 리뷰 발견사항
* [Context review](context-review.md) - 계획 문서 정합성 판정
