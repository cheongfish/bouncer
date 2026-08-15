---
type: bouncer.tasks
title: 기반 모듈 strict와 TypeScript lint
description: Tasks for 003
resource: .bouncer/context/epics/039-open-source-one-zero/blueprints/001-security-legal-baseline/tasks/003/tasks.md
tags:
  - bouncer
  - tasks
timestamp: '2026-08-15T15:42:17.241+09:00'
bouncer:
  id: TASKS-003
  epic_id: '039'
  blueprint_id: '001'
  status: verified
  verify: npm run verify:strict
  commit_intent:
    - 경로·문서·설정 기반 모듈의 암시적 any가 상위 모듈 전체로 전파되어 strict 전환을 막고 있음
    - 의존 방향의 바닥부터 타입을 고정하고 공개 CommonJS export와 런타임 동작을 유지함
  affected_paths:
    - tsconfig.strict.json
    - package.json
    - package-lock.json
    - eslint.config.js
    - scripts/src/lib/config.ts
    - scripts/src/lib/frontmatter.ts
    - scripts/src/lib/render.ts
    - scripts/src/lib/time.ts
    - scripts/src/lib/templates.ts
    - scripts/src/lib/tasks-docs.ts
    - scripts/src/lib/paths.ts
    - scripts/src/lib/layout.ts
    - scripts/src/lib/scope.ts
    - scripts/src/lib/subagents.ts
    - scripts/lib/config.js
    - scripts/lib/frontmatter.js
    - scripts/lib/render.js
    - scripts/lib/time.js
    - scripts/lib/templates.js
    - scripts/lib/tasks-docs.js
    - scripts/lib/paths.js
    - scripts/lib/layout.js
    - scripts/lib/scope.js
    - scripts/lib/subagents.js
  graph:
    generated_at: '2026-08-15T15:55:18+09:00'
    command: 'graphify query "TypeScript strict ESLint foundation config frontmatter render time templates tasks paths layout scope subagents" --graph graphify-out/{source,context}/graph.json'
    suggested_paths:
      - scripts/src/lib
      - scripts/lib
      - test
      - .bouncer/context/epics/006-scripts-typescript
      - .bouncer/context/epics/009-subagent-model-config
      - .bouncer/context/epics/018-task-unit-commits/blueprints/001-tasks-doc-resolver
    basis:
      - graph: source
        status: reused
        query: TypeScript strict ESLint foundation config frontmatter render time templates tasks paths layout scope subagents
        result: '3 nodes; top paths: scripts/src/lib/templates.ts, scripts/lib/templates.js, test/runtime-state.test.js'
      - graph: context
        status: reused
        query: TypeScript strict ESLint foundation config frontmatter render time templates tasks paths layout scope subagents
        result: '3 nodes; top paths: epic 006, epic 009, and epic 018 context'
---
# Tasks

Blueprint: [001](../../index.md)

## Goal & intent
경로, frontmatter, 설정, task 문서, 템플릿, scope 기반 모듈을 `strict: true`로
검사한다. 임시 `tsconfig.strict.json`은 이 모듈군만 include해 다음 커밋이 같은
차단선을 확장할 수 있게 한다. 공개 `module.exports` 키와 CJS 실행 결과는 바꾸지 않는다.

## Interface
- 제공: 함수 매개변수·반환값·문서 frontmatter·경로 값에 명시적 타입을 부여하고,
  `tsconfig.strict.json`의 `npm run typecheck:strict` 진입점과
  `typescript-eslint` 기반 TypeScript lint를 추가한다.
- 거부: 암시적 `any`, 근거 없는 `any`, `@ts-ignore`, 이중 assertion으로 오류를
  숨기는 방식, 공개 export 이름·값 변경을 허용하지 않는다.

## Touch
- Create `tsconfig.strict.json` — 기반 모듈 include와 `strict: true`, `noEmit: true`를 둔다.
- Modify `package.json` — `typescript-eslint@^8.67.0`과 중간 커밋용
  `typecheck:strict`, `verify:strict` script를 추가한다. `verify:strict`는 test,
  strict typecheck, lint를 순서대로 실행한다.
- Modify `package-lock.json` — 새 개발 의존성 해석 결과를 고정한다.
- Modify `eslint.config.js` — TypeScript parser와 recommended 규칙을 추가하고 첫
  모듈군 파일만 대상으로 연다.
- Modify `scripts/src/lib/config.ts` — JSON 읽기 결과와 오류를 좁힌다.
- Modify `scripts/src/lib/frontmatter.ts` — YAML 결과와 문서 형태를 타입으로 고정한다.
- Modify `scripts/src/lib/render.ts` — 렌더 입력 타입을 고정한다.
- Modify `scripts/src/lib/time.ts` — 시간 함수 경계를 타입으로 고정한다.
- Modify `scripts/src/lib/templates.ts` — 템플릿 키와 반환 타입을 고정한다.
- Modify `scripts/src/lib/tasks-docs.ts` — task unit·문서 목록 타입을 고정한다.
- Modify `scripts/src/lib/paths.ts` — 경로 입력·파싱 결과 타입을 고정한다.
- Modify `scripts/src/lib/layout.ts` — 레이아웃 helper 입력 타입을 고정한다.
- Modify `scripts/src/lib/scope.ts` — 허용 경로 집합과 판정 입력 타입을 고정한다.
- Modify `scripts/src/lib/subagents.ts` — provider 설정과 반환 모델 타입을 고정한다.
- Modify `scripts/lib/config.js` — TypeScript 변경의 CJS emit을 동기화한다.
- Modify `scripts/lib/frontmatter.js` — TypeScript 변경의 CJS emit을 동기화한다.
- Modify `scripts/lib/render.js` — TypeScript 변경의 CJS emit을 동기화한다.
- Modify `scripts/lib/time.js` — TypeScript 변경의 CJS emit을 동기화한다.
- Modify `scripts/lib/templates.js` — TypeScript 변경의 CJS emit을 동기화한다.
- Modify `scripts/lib/tasks-docs.js` — TypeScript 변경의 CJS emit을 동기화한다.
- Modify `scripts/lib/paths.js` — TypeScript 변경의 CJS emit을 동기화한다.
- Modify `scripts/lib/layout.js` — TypeScript 변경의 CJS emit을 동기화한다.
- Modify `scripts/lib/scope.js` — TypeScript 변경의 CJS emit을 동기화한다.
- Modify `scripts/lib/subagents.js` — TypeScript 변경의 CJS emit을 동기화한다.

## Do not touch
- `test` — 타입 주석 때문에 동작 단언을 바꾸지 않는다.
- `hooks` — 공개 CommonJS export 소비자는 그대로 둔다.
- `tsconfig.json` — 전체 strict 전환은 TASKS-007이 맡는다.

## Constraints
- CommonJS `require`·`module.exports`와 파일 이름을 유지한다.
- 외부 입력은 `unknown`에서 검증해 좁히고, 내부 편의를 위해 `any`로 풀지 않는다.
- 타입 전용 변경으로 게이트 코드·오류 문구·JSON 형태를 바꾸지 않는다.
- 소스를 고친 뒤 `npm run build`로 emit을 함께 커밋한다.
- TypeScript용 core `no-undef`·`no-unused-vars`는 끄고 대응하는
  `typescript-eslint` 규칙을 사용한다. recommended 규칙 자체를 통째로 끄지 않는다.

## Checklist
- [ ] `tsconfig.strict.json`, `typecheck:strict`, `typescript-eslint` 설정을 추가하고
  현재 타입·lint 오류를 확인한다.
- [ ] 각 함수 경계와 외부 입력에 타입을 추가해 `npm run typecheck:strict`를 통과시킨다.
- [ ] `rg -n "@ts-ignore|as unknown as|:\\s*any\\b"`로 우회가 없는지 확인한다.
- [ ] `npm run build`로 해당 CJS emit을 동기화한다.
- [ ] `npm run verify:strict`가 test, strict typecheck, lint 순서로 통과하는지 확인한다.
