---
type: bouncer.tasks
title: 기본 TypeScript strict 전환
description: Tasks for 007
resource: .bouncer/context/epics/039-open-source-one-zero/blueprints/001-security-legal-baseline/tasks/007/tasks.md
tags:
  - bouncer
  - tasks
timestamp: '2026-08-15T15:42:17.585+09:00'
bouncer:
  id: TASKS-007
  epic_id: '039'
  blueprint_id: '001'
  status: verified
  verify: npm run verify:strict
  commit_intent:
    - 별도 migration config만 strict하면 새 파일이 느슨한 기본 config로 되돌아갈 수 있음
    - 기본 tsconfig를 strict로 전환하고 임시 경로를 제거해 모든 빌드와 typecheck가 같은 계약을 쓰게 함
  affected_paths:
    - tsconfig.json
    - tsconfig.strict.json
    - package.json
    - eslint.config.js
  graph:
    generated_at: '2026-08-15T15:55:18+09:00'
    command: 'graphify query "TypeScript strict default tsconfig typecheck configuration cutover" --graph graphify-out/{source,context}/graph.json'
    suggested_paths:
      - scripts/src/lib
      - .bouncer/context/epics/006-scripts-typescript
      - .bouncer/context/epics/031-document-schema/blueprints/001-schema-cutover
    basis:
      - graph: source
        status: reused
        query: TypeScript strict default tsconfig typecheck configuration cutover
        result: '62 nodes; top paths: scripts/src/lib, including validate.ts, cli.ts, session-graph.ts'
      - graph: context
        status: reused
        query: TypeScript strict default tsconfig typecheck configuration cutover
        result: '6 nodes; top paths: epic 006 and epic 031 context'
---
# Tasks

Blueprint: [001](../../index.md)

## Goal & intent
기본 `tsconfig.json`을 `strict: true`로 바꾸고 임시 `tsconfig.strict.json`을
제거한다. `npm run build`와 `npm run typecheck`가 46개 TypeScript 파일 전체에
같은 strict 계약을 적용한다. TASKS-003~006에서 이미 타입과 lint 오류를 닫았으므로
제품 소스나 테스트는 이 커밋에서 바꾸지 않는다.

## Interface
- 제공: `tsconfig.json.compilerOptions.strict === true`; 기본 build와 typecheck가
  전체 소스 strict 오류에서 non-zero로 종료한다.
- 거부: 별도 strict include에만 의존하는 상태, `strictNullChecks` 등 하위 옵션
  재비활성화, 소스 제외·`any`·ignore로 통과시키는 방식을 허용하지 않는다.

## Touch
- Modify `tsconfig.json` — `strict`를 `true`로 바꾼다.
- Delete `tsconfig.strict.json` — 단계적 전환용 임시 config를 제거한다.
- Modify `package.json` — 임시 `typecheck:strict`를 제거하고 `verify:strict`가 기본
  `typecheck`를 사용하게 바꾼다.
- Modify `eslint.config.js` — `parserOptions.project`를 삭제한 임시 config 대신
  `./tsconfig.json`으로 바꾼다. 규칙 집합은 바꾸지 않는다.

## Do not touch
- `scripts/src/lib` — 앞선 네 task에서 strict와 lint를 통과한 소스를 다시 고치지 않는다.
- `scripts/lib` — config 전환은 새 emit diff를 만들지 않는다.
- `test` — 타입 config 전환을 위해 동작 단언을 바꾸지 않는다.

## Constraints
- `include`는 `scripts/src/lib/**/*.ts`를 유지한다.
- `skipLibCheck` 등 strict와 무관한 compiler option을 이 커밋에서 바꾸지 않는다.
- `npm run build` 후 `scripts/lib` diff가 없어야 한다.

## Checklist
- [ ] 기본 config를 strict로 바꾸고 임시 config와 script를 제거한다.
- [ ] `npm run verify:strict`가 test, 기본 typecheck, lint 순서로 통과하는지 확인한다.
- [ ] `npm run build` 뒤 `git diff --exit-code -- scripts/lib`가 깨끗한지 확인한다.
- [ ] `npm test`를 실행한다.
