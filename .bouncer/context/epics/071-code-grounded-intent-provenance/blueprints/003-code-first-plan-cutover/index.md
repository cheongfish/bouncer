---
type: bouncer.blueprint
title: 코드 우선 Plan 전환
description: Moves Plan discovery from the context graph to current code and function intent provenance and retires the G4 and S9 scope-evidence checks.
resource: .bouncer/context/epics/071-code-grounded-intent-provenance/blueprints/003-code-first-plan-cutover/index.md
tags:
  - bouncer
  - blueprint
  - plan
  - intent
  - scope-evidence
  - symbol-index
timestamp: '2026-09-15T22:04:44.633+09:00'
bouncer:
  id: '003'
  epic_id: '071'
  blueprint_id: '003'
  status: closed
  commit_type: feat
  scale: full
  supersedes: []
---
# 코드 우선 Plan 전환

Epic: [071](../../index.md)

## Intent
- 문제: Plan이 context graph 검색과 Graphify `scope_evidence`에 기대어 오래된 문서를 현재 동작처럼 고를 수 있고, 모든 구현 task가 조언용 후보를 frontmatter에 기록해야 G4·S9를 통과한다.
- 완료 조건: Plan이 현재 코드와 `bouncer intent`로 관련 함수의 의도를 읽고, `scope_evidence` 없이 G5·G11·G12로 승인 범위를 판정한다.

## Contract
- 선후 관계: BP 004(context graph 제거)는 이 blueprint가 `closed` 상태가 된 뒤 실행한다. 이 blueprint가 Plan의 `context-search` 호출과 `scope_evidence`·G4·S9를 먼저 걷어내야 BP 004가 CLI와 graph를 지워도 Plan이 깨지지 않는다. 두 blueprint는 같은 릴리스로 배포한다.
- 인터페이스:
  - `bouncer validate`는 G4와 S9를 발행하지 않는다. 두 번호는 결번으로 기록하고 다른 검사에 재사용하지 않는다.
  - `bouncer scaffold blueprint`와 `bouncer scaffold task`가 만드는 commit task frontmatter에 `scope_evidence` 키가 없다.
  - `scripts/src/lib/validate-structural.ts` export에서 `normalizeScopeEvidence`, `isValidGraphBasis`, `GRAPH_BASIS_STATUS`, `GRAPH_BASIS_GRAPH`를 삭제한다.
  - `/bouncer-plan` Discover는 scaffold 전에 현재 코드에서 함수 정의를 찾고 `bouncer intent --symbol`을 호출한다. `context-search`와 `graphify-out/context/graph.json`은 호출하지 않는다.
  - `bouncer intent`의 인자와 출력 형태는 그대로다. 반환 타입에 `x is T`·`asserts x is T`를 쓴 파일의 함수도 후보에 들어간다.
- 데이터·상태:
  - 기존 계획 문서에 남은 `scope_evidence`·`graph` 필드를 읽는 코드는 없다. 형식이 깨져 있어도 실패를 내지 않고, 일괄 삭제하지 않는다.
  - Plan은 intent 결과와 `graph-suggest` 후보를 frontmatter에 저장하지 않는다. 코드 근거는 task 본문 Current behavior에 쓴다.
- 수용 기준: epic Success criteria 22–28이 참이다.
- 검증 명령: 구현 task는 `npm test`, 종단 verification task는 `npm run ci`.
- 실패 모드·엣지 케이스:
  - `bouncer intent`가 `ambiguous`를 반환하면 Plan은 후보를 추측하지 않는다. 코드 탐색 근거로 하나를 골라 `--candidate`로 다시 호출하고, 근거가 없으면 사용자에게 묻는다. 발급되지 않은 ref는 exit 1이므로 다시 탐색한다.
  - `unresolved`, `unlinked`, Git 조회 오류(exit 1)는 그 함수의 provenance가 없는 상태로 기록하고 Plan을 계속한다.
  - freshness가 `possibly-superseded`면 코드를 현재 동작으로 쓰고, 과거 제약을 유지할지 사용자에게 확인한다. `historical` 본문은 입력으로 쓰지 않는다.
  - Graphify source graph가 없으면 `graph-suggest`를 건너뛰고 `affected_paths`는 사용자가 수동으로 확정한다.
  - light blueprint도 G4 없이 G5·G11을 그대로 받는다.
  - `.ts`를 고칠 때 대응 `scripts/lib/*.js`를 같은 commit에 넣는다. 그러지 않으면 `check:emit`이 실패한다.
  - 코드 삭제로 coverage 비율(lines 94 / branches 82 / functions 96)이 기준 밑으로 떨어지면 종단 task가 그 실행을 실패로 기록한다.

## Out of scope
- BP 004가 맡는 범위: `context-search` CLI·parser·help, `graph-sync`·`graph-suggest`의 context scope와 `candidates.context`, graphify-runner의 context 서술(graph 표 context 행, Step 1, Step 2 context query 처리, Step 3·4의 context 후보 서술), `skills/bouncer-run/SKILL.md`·`skills/bouncer-execute/SKILL.md`의 context retrieval 절, `rules/okf.md`의 tags·digest anchor 절, spec-authoring의 Discovery fields·Domain tags·Stop slop 절, `context_dirs`
- 기존 계획 문서의 `scope_evidence`·`graph` 필드 일괄 삭제. `skills/bouncer-execute/SKILL.md`의 `scope_evidence` 주입 제외 규칙은 남기고 이유 문장만 고친다.
- intent 결과를 담는 새 frontmatter 필드
- 범용 TypeScript parser, 그리고 type predicate 밖의 원인으로 symbol index가 버리는 `current.ts`·`runtime-state.ts`·`graphify.ts`·`symbol-index.ts`
- `references/implementation/index.md`의 주석 작성 예시
- Epic 071 terminal verification

## One-commit justification
- 한 PR 안에서 네 commit으로 나눈다. 순서는 task DAG가 정한다. TASKS-001과 TASKS-002는 선행 task가 없고, TASKS-003과 TASKS-004는 TASKS-002가 `integrated` 된 뒤 연다.
- 각 commit은 한 surface와 그 surface를 단언하는 테스트를 함께 고친다. 그래서 commit마다 `npm test`가 통과한다.

## Documents
* [Task 001](tasks/001/tasks.md) - 타입 술어 반환 타입 파싱
* [Task 002](tasks/002/tasks.md) - G4·S9와 scaffold 기본값 제거
* [Task 003](tasks/003/tasks.md) - Plan 탐색의 코드 우선 전환
* [Task 004](tasks/004/tasks.md) - `scope_evidence` 작성 안내 삭제
* [Task 005](tasks/005/tasks.md) - 종단 `npm run ci` 검증
* [Context review](context-review.md) - 계획 문서 정합성 판정
