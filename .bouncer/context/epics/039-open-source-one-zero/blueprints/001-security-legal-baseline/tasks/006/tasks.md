---
type: bouncer.tasks
title: 그래프와 CLI 모듈 strict 타입
description: Tasks for 006
resource: .bouncer/context/epics/039-open-source-one-zero/blueprints/001-security-legal-baseline/tasks/006/tasks.md
tags:
  - bouncer
  - tasks
timestamp: '2026-08-15T15:42:17.492+09:00'
bouncer:
  id: TASKS-006
  epic_id: '039'
  blueprint_id: '001'
  status: verified
  verify: npm run verify:strict
  commit_intent:
    - 그래프·Distill·CLI 오케스트레이션의 any가 외부 명령 결과와 라우팅 상태의 잘못된 조합을 숨기고 있음
    - 남은 모듈의 입력과 결과를 좁혀 전체 TypeScript 소스가 strict 검사를 통과하게 함
  affected_paths:
    - tsconfig.strict.json
    - eslint.config.js
    - scripts/src/lib/context-digest.ts
    - scripts/src/lib/distill.ts
    - scripts/src/lib/graph-scope.ts
    - scripts/src/lib/graph-exec.ts
    - scripts/src/lib/graphify.ts
    - scripts/src/lib/session-graph.ts
    - scripts/src/lib/init.ts
    - scripts/src/lib/cli-flags.ts
    - scripts/src/lib/cli-current-command.ts
    - scripts/src/lib/cli-doc-commands.ts
    - scripts/src/lib/cli-git-commands.ts
    - scripts/src/lib/cli-project-commands.ts
    - scripts/src/lib/cli.ts
    - scripts/src/lib/schema.ts
    - scripts/src/lib/import-history.ts
    - scripts/src/lib/import-git.ts
    - scripts/src/lib/import-render.ts
    - scripts/src/lib/import-types.ts
    - scripts/lib/context-digest.js
    - scripts/lib/distill.js
    - scripts/lib/graph-scope.js
    - scripts/lib/graph-exec.js
    - scripts/lib/graphify.js
    - scripts/lib/session-graph.js
    - scripts/lib/init.js
    - scripts/lib/cli-flags.js
    - scripts/lib/cli-current-command.js
    - scripts/lib/cli-doc-commands.js
    - scripts/lib/cli-git-commands.js
    - scripts/lib/cli-project-commands.js
    - scripts/lib/cli.js
    - scripts/lib/schema.js
    - scripts/lib/import-history.js
    - scripts/lib/import-git.js
    - scripts/lib/import-render.js
    - scripts/lib/import-types.js
  graph:
    generated_at: '2026-08-15T15:55:18+09:00'
    command: 'graphify query "TypeScript strict graph CLI context digest distill graphify session init schema import history" --graph graphify-out/{source,context}/graph.json'
    suggested_paths:
      - scripts/src/lib
      - scripts/lib
      - test
      - .bouncer/context/epics/026-context-graph-slim/blueprints/001-context-section-digest
      - .bouncer/context/epics/027-history-import
      - .bouncer/context/epics/027-history-import/blueprints/001-history-import-cli
    basis:
      - graph: source
        status: reused
        query: TypeScript strict graph CLI context digest distill graphify session init schema import history
        result: '3 nodes; top paths: scripts/src/lib/init.ts, scripts/lib/init.js, test/schema.test.js'
      - graph: context
        status: reused
        query: TypeScript strict graph CLI context digest distill graphify session init schema import history
        result: '3 nodes; top paths: epic 026 and epic 027 context'
---
# Tasks

Blueprint: [001](../../index.md)

## Goal & intent
Distill, graph, init, session graph와 CLI command 모듈을 strict 범위에 추가한다.
이 task가 끝나면 오류가 없던 파일을 포함한 `scripts/src/lib/**/*.ts` 전체가 임시
strict config를 통과한다. CLI 사용법, JSON stdout, graph fail-open 상태는 유지한다.

## Interface
- 제공: Distill shard/index/route, graph plan/result, init result, CLI IO/handler의
  타입을 정의하고 strict include를 `scripts/src/lib/**/*.ts` 전체로 확장한다.
- 거부: CLI 명령·플래그·출력, Distill fail-open 규칙, graph status 어휘,
  init idempotency, provider fallback 변경과 타입 오류 은폐를 허용하지 않는다.

## Touch
- Modify `tsconfig.strict.json` — include를 `scripts/src/lib/**/*.ts` 전체로 넓힌다.
- Modify `eslint.config.js` — TypeScript lint 대상을 `scripts/src/lib/**/*.ts` 전체로 넓힌다.
- Modify `scripts/src/lib/context-digest.ts` — digest 입력·map·선택 결과 타입을 고정한다.
- Modify `scripts/src/lib/distill.ts` — shard 선언·route·audit 결과 타입을 고정한다.
- Modify `scripts/src/lib/graph-scope.ts` — graph 범위·mtime plan 타입을 고정한다.
- Modify `scripts/src/lib/graph-exec.ts` — 외부 graphify 실행과 결과 타입을 고정한다.
- Modify `scripts/src/lib/graphify.ts` — 설치·binary 탐색 결과 타입을 고정한다.
- Modify `scripts/src/lib/session-graph.ts` — source/context graph plan과 경고 타입을 고정한다.
- Modify `scripts/src/lib/init.ts` — bootstrap·설정·graphify setup 결과 타입을 고정한다.
- Modify `scripts/src/lib/cli-flags.ts` — argv parser 입력·출력 타입을 고정한다.
- Modify `scripts/src/lib/cli-current-command.ts` — current command IO와 handler 타입을 고정한다.
- Modify `scripts/src/lib/cli-doc-commands.ts` — 문서 command IO와 오류 타입을 고정한다.
- Modify `scripts/src/lib/cli-git-commands.ts` — Git command IO와 결과 타입을 고정한다.
- Modify `scripts/src/lib/cli-project-commands.ts` — project command IO와 JSON payload 타입을 고정한다.
- Modify `scripts/src/lib/cli.ts` — command registry·argv·IO 타입을 고정한다.
- Modify `scripts/src/lib/schema.ts` — 전체 lint 전환에서 보고되는 TypeScript 규칙만 고친다.
- Modify `scripts/src/lib/import-history.ts` — 전체 lint 전환에서 보고되는 TypeScript 규칙만 고친다.
- Modify `scripts/src/lib/import-git.ts` — 전체 lint 전환에서 보고되는 TypeScript 규칙만 고친다.
- Modify `scripts/src/lib/import-render.ts` — 전체 lint 전환에서 보고되는 TypeScript 규칙만 고친다.
- Modify `scripts/src/lib/import-types.ts` — 전체 lint 전환에서 보고되는 TypeScript 규칙만 고친다.
- Modify `scripts/lib/context-digest.js` — TypeScript 변경의 CJS emit을 동기화한다.
- Modify `scripts/lib/distill.js` — TypeScript 변경의 CJS emit을 동기화한다.
- Modify `scripts/lib/graph-scope.js` — TypeScript 변경의 CJS emit을 동기화한다.
- Modify `scripts/lib/graph-exec.js` — TypeScript 변경의 CJS emit을 동기화한다.
- Modify `scripts/lib/graphify.js` — TypeScript 변경의 CJS emit을 동기화한다.
- Modify `scripts/lib/session-graph.js` — TypeScript 변경의 CJS emit을 동기화한다.
- Modify `scripts/lib/init.js` — TypeScript 변경의 CJS emit을 동기화한다.
- Modify `scripts/lib/cli-flags.js` — TypeScript 변경의 CJS emit을 동기화한다.
- Modify `scripts/lib/cli-current-command.js` — TypeScript 변경의 CJS emit을 동기화한다.
- Modify `scripts/lib/cli-doc-commands.js` — TypeScript 변경의 CJS emit을 동기화한다.
- Modify `scripts/lib/cli-git-commands.js` — TypeScript 변경의 CJS emit을 동기화한다.
- Modify `scripts/lib/cli-project-commands.js` — TypeScript 변경의 CJS emit을 동기화한다.
- Modify `scripts/lib/cli.js` — TypeScript 변경의 CJS emit을 동기화한다.
- Modify `scripts/lib/schema.js` — lint 수정이 emit에 영향을 줄 때 동기화한다.
- Modify `scripts/lib/import-history.js` — lint 수정이 emit에 영향을 줄 때 동기화한다.
- Modify `scripts/lib/import-git.js` — lint 수정이 emit에 영향을 줄 때 동기화한다.
- Modify `scripts/lib/import-render.js` — lint 수정이 emit에 영향을 줄 때 동기화한다.
- Modify `scripts/lib/import-types.js` — lint 수정이 emit에 영향을 줄 때 동기화한다.

## Do not touch
- `test` — CLI·Distill·graph 단언을 타입 작업에 맞춰 변경하지 않는다.
- `skills` — 워크플로의 graph/Distill 호출 순서는 유지한다.
- `tsconfig.json` — 기본 strict 전환은 TASKS-007이 맡는다.

## Constraints
- stdout JSON과 stderr 진단 분리를 유지한다.
- graphify 부재·오래된 그래프·불확실한 Distill route의 기존 fail-open을 유지한다.
- CLI handler 공통 타입이 순환 require나 새 런타임 모듈을 만들지 않게 type-only로 둔다.
- 전체 strict 통과를 위해 테스트나 컴파일 옵션을 느슨하게 하지 않는다.

## Checklist
- [ ] strict include와 ESLint 대상을 전체 glob으로 넓혀 남은 오류를 확인한다.
- [ ] 외부 command·filesystem·JSON 경계를 `unknown`에서 좁히고 내부 상태 타입을 연결한다.
- [ ] `npx tsc -p tsconfig.strict.json --pretty false`가 오류 0인지 확인한다.
- [ ] `npm run build`로 변경된 TypeScript의 CJS emit을 동기화한다.
- [ ] `npm run verify:strict`를 실행한다.
