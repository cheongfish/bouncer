---
type: bouncer.blueprint
title: 공유 계약 정본과 DAG·경로 규칙 추출
description: Add canonical review policy and execution contracts, extract DAG and path rules to remove the dependency cycle, convert implementation-pinned tests, and record the boundary inventory
resource: .bouncer/context/epics/source-restructuring/blueprints/foundation-cleanup/index.md
tags:
  - bouncer
  - blueprint
  - refactor
  - dag
  - coordinator
  - test-contract
timestamp: '2026-10-16T13:46:29.738+09:00'
bouncer:
  id: foundation-cleanup
  epic_id: source-restructuring
  blueprint_id: foundation-cleanup
  status: closed
  order: 1
  commit_type: feat
  scale: full
  review_scope: blueprint
  supersedes: []
---
# 공유 계약 정본과 DAG·경로 규칙 추출

Epic: [106](../../index.md)

## Intent
- 문제: 리뷰 위험도·관점 목록과 Task·ledger 타입이 파일마다 복제돼 있고, `current`가 `readyWave` 하나 때문에 `coordinator` 전체를 가져와 `verification → current → coordinator → verification` 순환이 생긴다.
- 완료 조건: 정책·계약 정본과 I/O 없는 DAG·경로 모듈이 생겨 순환이 사라지고, 구현 배치에 고정된 테스트가 동작 검사로 바뀌며, 이후 blueprint가 쓸 소비자·경계 inventory가 문서로 남는다.

## Contract
- 인터페이스:
  - `scripts/src/lib/review-policy.ts`: `REVIEW_RISK_ENUM`(`public_interface`, `authentication`, `authorization`, `credential`)과 execute 리뷰 관점 목록 `REVIEW_PERSPECTIVE`(`combined`, `spec_scope`, `correctness_tests`, `minimality_maintainability`, `security`)를 내보낸다.
  - `scripts/src/lib/execution-contracts.ts`: 타입만 내보내는 모듈. `Task`, `Ledger`, `DispatchState`, `Lease`, `LedgerRef`의 정본이다. 컴파일 결과에 런타임 `require`가 없다.
  - `scripts/src/lib/execution-dag.ts`: `readyWave(tasks, options?)`, `tasksConflict(left, right)`, `transition(from, to, executionKind?)`, `normalizeOverlapPath(raw)`.
  - `scripts/src/lib/path-overlap.ts`: `pathsOverlap(a, b)`.
  - `coordinator`는 `readyWave`·`transition`을, `validate-sections`는 `pathsOverlap`을 기존 이름으로 계속 내보낸다.
- 데이터·상태: 저장 형식과 ledger 필드 변경은 없다. 타입 선언 위치만 바뀐다.
- 수용 기준: 에픽 성공 기준 1·2·3·9와 10의 기준선. TASKS-001이 3, TASKS-002가 1·2, TASKS-003·TASKS-005가 9의 전환 대상, TASKS-004가 9의 추적 문서와 10의 기준선을 맡는다. 에픽 성공 기준 11의 `npm run ci`는 task verify(`npm test`)가 아니라 PR의 CI가 판정하고, 각 task Checklist의 중간 점검(`typecheck`, `check:emit`, `lint:test-names`, `test:coverage`)이 임계값 유지를 미리 확인한다.
- 검증 명령: `npm test`
- 실패 모드·엣지 케이스:
  - 정본 모듈이 `validate-*`·`coordinator`·`scope`를 가져오면 새 순환이 생긴다. 정본은 잎(leaf) 모듈이어야 하고 `scope.ts`가 `coordinator`를 가져오지 않는 기존 제약을 지킨다.
  - 읽기 타입이 의도적으로 정본보다 넓은 필드(`coordinate-next`의 `execution_kind: string`)는 `Pick`으로 파생되지 않는다. 그 필드만 `Omit` 후 재선언하고 이유를 주석으로 남긴다.
  - `CONTEXT_REVIEW_PERSPECTIVE`(계획 리뷰 관점)는 execute 관점과 다른 목록이므로 합치지 않는다.
  - `readyWave`의 `./`·trailing slash 정규화 결과는 추출 전후 같아야 하고, `dag-shape`의 사본 정규화도 같은 결과를 내야 한다.
  - 테스트를 지우거나 바꿔도 보호하던 실패 모드는 다른 검사로 남아야 하며 coverage 임계값(94/82/96)은 그대로다.

## Out of scope
- `coordinator`의 원장 저장·명령 처리 분리, CLI 지연 로더, `finalize` 분리(후속 blueprint).
- reason 레지스트리 도입과 `public-name-regression`의 허용 목록 분리(inventory에 후보로만 기록).
- 기존 export의 일괄 삭제와 새 공개 인터페이스 도입.

## One-commit justification
- 다섯 변경이 모두 같은 불변 조건(동작 보존)을 공유하고, 정본 추출(001) → 순환 제거(002) → 이를 쓰는 테스트 전환(003)이 한 흐름이다. 004·005는 독립 경로라 병렬로 검토된다. 흐름이 끊기면 순환 제거 검사나 정본 파생 검사를 증명할 수 없다.

## Documents
* [Tasks](tasks/001/tasks.md) - 구현 브리프
* [Verification](tasks/001/verification.md) - 검증 명령과 증적
* [Tasks 002](tasks/002/tasks.md) - DAG·경로 규칙 추출
* [Verification 002](tasks/002/verification.md) - 검증 명령과 증적
* [Tasks 003](tasks/003/tasks.md) - 런타임 probe 테스트 전환
* [Verification 003](tasks/003/verification.md) - 검증 명령과 증적
* [Tasks 004](tasks/004/tasks.md) - 소비자·경계 inventory 문서
* [Verification 004](tasks/004/verification.md) - 검증 명령과 증적
* [Tasks 005](tasks/005/tasks.md) - 텍스트 계약 테스트 전환
* [Verification 005](tasks/005/verification.md) - 검증 명령과 증적
* [Review](review.md) - 리뷰 발견사항
* [Context review](context-review.md) - 계획 문서 정합성 판정
