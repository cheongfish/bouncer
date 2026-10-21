---
type: bouncer.epic
title: 소스 helper 정리와 동작 중심 테스트 전환
description: Consolidate duplicated source helpers and shift tests to behavior-focused, tiered suites with consumer-facing testing guidance.
resource: .bouncer/context/epics/source-test-hygiene/index.md
tags:
  - bouncer
  - epic
  - refactor
  - testing
  - ci
timestamp: '2026-10-11T14:18:15.381+09:00'
bouncer:
  id: source-test-hygiene
  epic_id: source-test-hygiene
  status: approved
  supersedes: []
---
# 092 소스 helper 정리와 동작 중심 테스트 전환

## Intent
같은 helper가 여러 모듈에 복사돼 있어 승인·검증 digest 계산이 파일마다 어긋날 수 있음.
테스트 2,102개 가운데 문서 문구를 정규식으로 검사하는 테스트와 매번 git 저장소를 새로 만드는 테스트가 verify·CI 시간을 늘림.
이 epic은 helper를 한 곳으로 모으고, 테스트를 동작 검증 위주의 unit·integration 계층으로 나누며, 소비 프로젝트 워커가 같은 원칙으로 테스트를 쓰도록 지침을 추가함.

## Success criteria
1. `canonicalJson`과 `sha256Canonical`은 `scripts/src/lib` 안에 정의가 하나뿐이고, 같은 입력에 대한 digest 값은 통합 전과 같다.
2. `isRecord`·`toPosix`·`catchMessage`는 `scripts/src/lib` 안에 정의가 하나뿐이다. `toPosix`는 모든 `\`를 `/`로 바꾼다.
3. `paths.ts`와 `tasks-docs.ts` 사이에 import 순환이 없고, `tasks-docs.ts`에 함수 안 지연 `require('./paths')`가 없다.
4. `npm run test:unit`과 `npm run test:integration`이 실행하는 테스트 파일의 합집합은 `test/*.test.js` 전체와 같고 교집합은 비어 있다. 어느 계층에도 없거나 두 계층에 모두 있는 파일이 있으면 검사 테스트가 실패한다.
5. `npm run test:unit`은 `child_process`의 프로세스 생성 함수를 호출하면 예외를 던지는 guard를 먼저 로드한 상태로 실행되고 통과하며, `npm run ci`가 이 실행을 포함한다.
6. `test:coverage`는 `--test-concurrency=1` 없이 실행되고 기존 임계값(lines 94, branches 82, functions 96)을 통과한다.
7. `coordinator.test.js`·`commit-task.test.js`·`coordinate-next.test.js`·`finalize.test.js`·`cli-coordinate.test.js`는 파일당 한 번 만든 fixture 저장소를 복사해 쓰고, `git init`은 템플릿 `setup` 함수와 빈 저장소가 검증 조건인 두 테스트(`cli-coordinate.test.js:772`, `coordinate-next.test.js:1358`)에서만 실행한다.
8. BP 002 TASKS-004·005·006이 대상으로 나열한 문서 전용 테스트 파일에 남은 문서 본문 대상 정규식·`includes` 단언은 기계가 읽는 계약 단언뿐이고, 옮긴 문서 구조 규칙은 `npm run lint:docs`가 검사한다.
9. `agents/bouncer-implementer.md`와 그 Codex 미러, `references/spec-authoring/index.md` Checklist 규칙, `references/review/assets/reviewer-prompt.md` 판정 기준에 동작 중심 테스트 규칙이 있다.
10. 변경한 TypeScript의 생성 JavaScript는 `npm run check:emit`을 통과하고, CHANGELOG `[Unreleased]`에 BP별 항목이 있으며, `npm run ci`가 통과한다.

## Out of scope
- `coordinate()`·`runCheckGate()`·`finalize()`·`prepareFinalizeDigest()` 같은 대형 함수 분해.
- `.bouncer/config.json`의 `verify` 값 변경. 사용자가 직접 `npm run test:unit`으로 바꾼다.
- `graphify-out/` gitignore 처리.
- 제품 CLI·게이트 동작 변경. 예외는 BP 001의 `toPosix` 통일로 Linux에서 백슬래시가 든 경로의 `symbol-index` 출력이 바뀌는 것 하나다.

## Blueprints
* [001 공용 helper 통합](../runtime-architecture/blueprints/shared-helpers/index.md) - `scripts/src/lib`에 복사된 digest·레코드·오류·경로 helper를 공용 모듈로 모으고 `paths`↔`tasks-docs` 순환을 없앤다.
* [002 동작 중심 테스트](../runtime-architecture/blueprints/behavior-tests/index.md) - 소비 프로젝트 테스트 지침을 넣고, 테스트를 unit·integration으로 나누며, 느린 git 테스트와 문서 문구 테스트를 정리한다.

## Execution order
BP 001 → BP 002 순서로 실행한다. 두 BP가 CHANGELOG를 공유하고, BP 002의 테스트 정리가 BP 001 이후 코드 기준으로 계층을 나누므로 동시에 실행하지 않는다. BP 사이 순서는 운영 순서이며 task `depends_on`에 다른 BP를 연결하지 않는다.
