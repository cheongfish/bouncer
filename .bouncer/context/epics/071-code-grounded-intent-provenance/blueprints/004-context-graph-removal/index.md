---
type: bouncer.blueprint
title: Context graph 제거
description: Removes the context graph CLI, build, query, config, and documentation surface so Graphify keeps only source and test scopes.
resource: .bouncer/context/epics/071-code-grounded-intent-provenance/blueprints/004-context-graph-removal/index.md
tags:
  - bouncer
  - blueprint
  - context-graph
  - context-search
  - graph-sync
  - graph-suggest
timestamp: '2026-09-15T17:19:43.100+09:00'
bouncer:
  id: '004'
  epic_id: '071'
  blueprint_id: '004'
  status: closed
  commit_type: feat
  scale: full
  supersedes: []
---
# Context graph 제거

Epic: [071](../../index.md)

## Intent
- 문제: Plan이 현재 코드와 intent provenance를 근거로 삼은 뒤에도 context graph의 생성·질의·설정이 남아 SessionStart 빌드와 검색 입력을 늘린다.
- 완료 조건: `context-search`와 context digest·graph를 제거하고 Graphify를 source·test 두 scope로 줄인다.

## Contract
- 선행 조건: BP 003(Code-first Plan cutover)이 closed된 뒤 실행한다. BP 003이 Plan skill의 `context-search` 호출, `scope_evidence`, G4·S9를 먼저 걷어내야 이 blueprint가 CLI와 graph를 지워도 Plan이 깨지지 않는다. 두 blueprint는 같은 릴리스로 배포한다.
- 인터페이스:
  - `bouncer context-search`는 등록되지 않은 명령이 되어 `unknown command`와 종료 코드 2로 끝난다. help 목록에도 없다.
  - `bouncer graph-sync`의 `graphs[]`는 `source`, `test` 두 행만 가진다.
  - `bouncer graph-suggest`의 `candidates`는 `implementation`, `test` 두 키만 가진다. `reasons`에 `context ...` 줄이 없다.
  - `contextSearch`, `validateContextSearchInput`, `normalizeQuery`, `CONTEXT_SEARCH_INPUT_SCHEMA` export와 `context-digest` 모듈을 삭제한다. `DEFAULT_CONTEXT_OUT`, `DEFAULT_CONTEXT_DIRS`, `realContextDirs` export도 삭제한다.
- 데이터·상태:
  - `init` 기본 config와 `config.example.json`에는 `context_dirs`가 없다.
  - 기존 config에 남은 `context_dirs`는 아무 코드도 읽지 않는다. 경고나 오류도 내지 않는다.
  - `graphify-out/context/**`와 `graphify-out/context-src/**`는 새로 만들지 않고, 읽지 않고, 지우지 않는다. `upgradeGraphify`의 snapshot·restore 대상에서도 빠진다.
- 수용 기준: epic Success criteria 16–21이 참이다.
- 검증 명령: 구현 task는 `npm test`, 종단 verification task는 `npm run ci`.
- 실패 모드·엣지 케이스:
  - `graphify-out/context/graph.json`이 남아 있거나 읽을 수 없는 파일이어도 `graph-suggest`와 `graph-sync`는 결과가 같다.
  - `test_dirs`가 없는 legacy config에서 `graphs[]`는 source와 skip-unconfigured test 두 행이다.
  - source·test가 모두 `skip-no-dirs`이면 요약 action은 `skip-no-dirs`를 유지한다.
  - `.ts`를 지울 때 대응 `scripts/lib/*.js`를 같은 commit에서 지운다. 그러지 않으면 `check:emit`이 실패한다.
  - 코드를 지워 coverage 비율(lines 94 / branches 82 / functions 96)이 기준 밑으로 떨어지면 종단 task가 실패로 기록한다.

## Out of scope
- BP 003 소유 surface: Plan skill과 `scope-confirm`·`graphify-suggestions` reference의 context-search 호출, discovery·spec-authoring의 context evidence 절, `scope_evidence` 작성·scaffold 기본값, G4·S9, `GRAPH_BASIS_GRAPH`·`SCOPE_CANDIDATE_ROLES`, 이 surface를 단언하는 테스트(`test/master-rules.test.js` 793행, `test/skill-bouncer-plan.test.js`, `test/skill-discovery.test.js`, `test/skill-spec-authoring.test.js`의 context evidence 단언)
- 사용자의 기존 `graphify-out/context/**` 삭제
- `.bouncer/context/**` 과거 문서, context-review, `lint:context-comments`
- Graphify payload 상한(로드맵 P1.1)과 Epic 071 terminal verification
- CHANGELOG 과거 항목과 `docs/distill-decommission-audit.md` 수정

## One-commit justification
- 한 PR 안에서 네 commit으로 나눈다. 순서는 검색 명령 → `graph-suggest` 점수 → graph 빌드 → 설정 기본값·문서다.
- 각 commit은 한 공개 surface만 지우고 그 surface의 테스트를 함께 고친다. 그래서 commit마다 `npm test`가 통과한다.

## Documents
* [Task 001](tasks/001/tasks.md) - `context-search` 명령 제거
* [Task 002](tasks/002/tasks.md) - `graph-suggest` context 점수 제거
* [Task 003](tasks/003/tasks.md) - context graph 빌드와 digest 모듈 제거
* [Task 004](tasks/004/tasks.md) - 설정 기본값과 context graph 문서 안내 삭제
* [Task 005](tasks/005/tasks.md) - 종단 `npm run ci` 검증
* [Context review](context-review.md) - 계획 문서 정합성 판정
