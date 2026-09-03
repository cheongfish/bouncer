---
type: bouncer.tasks
title: CommonJS 모듈 경계 타입 전환
description: Replaces duplicated CommonJS require casts with checked export-equals module contracts.
resource: .bouncer/context/epics/061-structural-audit-remediation/blueprints/003-correctness-contracts/tasks/002/tasks.md
tags:
  - bouncer
  - tasks
timestamp: '2026-09-03T14:42:19.171+09:00'
bouncer:
  id: TASKS-002
  epic_id: '061'
  blueprint_id: '003'
  status: verified
  commit_intent:
    - '모듈 소비자가 공급자 시그니처를 복제하지 않게 함'
    - '기존 CommonJS require 표면을 유지하며 타입 검사를 복구함'
  verify: npm run verify:strict
  affected_paths:
    - scripts/src/lib/cli-current-command.ts
    - scripts/lib/cli-current-command.js
    - scripts/src/lib/cli-doc-commands.ts
    - scripts/lib/cli-doc-commands.js
    - scripts/src/lib/cli-flags.ts
    - scripts/lib/cli-flags.js
    - scripts/src/lib/cli-git-commands.ts
    - scripts/lib/cli-git-commands.js
    - scripts/src/lib/cli-project-commands.ts
    - scripts/lib/cli-project-commands.js
    - scripts/src/lib/cli.ts
    - scripts/lib/cli.js
    - scripts/src/lib/codex-agents.ts
    - scripts/lib/codex-agents.js
    - scripts/src/lib/commit-guard.ts
    - scripts/lib/commit-guard.js
    - scripts/src/lib/commit-hook.ts
    - scripts/lib/commit-hook.js
    - scripts/src/lib/commit-sha.ts
    - scripts/lib/commit-sha.js
    - scripts/src/lib/commit.ts
    - scripts/lib/commit.js
    - scripts/src/lib/comprehension.ts
    - scripts/lib/comprehension.js
    - scripts/src/lib/config.ts
    - scripts/lib/config.js
    - scripts/src/lib/context-digest.ts
    - scripts/lib/context-digest.js
    - scripts/src/lib/current.ts
    - scripts/lib/current.js
    - scripts/src/lib/distill.ts
    - scripts/lib/distill.js
    - scripts/src/lib/epic-index.ts
    - scripts/lib/epic-index.js
    - scripts/src/lib/finalize.ts
    - scripts/lib/finalize.js
    - scripts/src/lib/frontmatter.ts
    - scripts/lib/frontmatter.js
    - scripts/src/lib/graph-exec.ts
    - scripts/lib/graph-exec.js
    - scripts/src/lib/graph-scope.ts
    - scripts/lib/graph-scope.js
    - scripts/src/lib/graph-search.ts
    - scripts/lib/graph-search.js
    - scripts/src/lib/graphify.ts
    - scripts/lib/graphify.js
    - scripts/src/lib/import-git.ts
    - scripts/lib/import-git.js
    - scripts/src/lib/import-history.ts
    - scripts/lib/import-history.js
    - scripts/src/lib/import-render.ts
    - scripts/lib/import-render.js
    - scripts/src/lib/init.ts
    - scripts/lib/init.js
    - scripts/src/lib/layout.ts
    - scripts/lib/layout.js
    - scripts/src/lib/migrate-ids.ts
    - scripts/lib/migrate-ids.js
    - scripts/src/lib/migrate-task-layout.ts
    - scripts/lib/migrate-task-layout.js
    - scripts/src/lib/paths.ts
    - scripts/lib/paths.js
    - scripts/src/lib/render.ts
    - scripts/lib/render.js
    - scripts/src/lib/runtime-state.ts
    - scripts/lib/runtime-state.js
    - scripts/src/lib/scaffold.ts
    - scripts/lib/scaffold.js
    - scripts/src/lib/schema.ts
    - scripts/lib/schema.js
    - scripts/src/lib/scope.ts
    - scripts/lib/scope.js
    - scripts/src/lib/seed-worktree.ts
    - scripts/lib/seed-worktree.js
    - scripts/src/lib/session-graph.ts
    - scripts/lib/session-graph.js
    - scripts/src/lib/subagents.ts
    - scripts/lib/subagents.js
    - scripts/src/lib/tasks-docs.ts
    - scripts/lib/tasks-docs.js
    - scripts/src/lib/templates.ts
    - scripts/lib/templates.js
    - scripts/src/lib/time.ts
    - scripts/lib/time.js
    - scripts/src/lib/validate-docs.ts
    - scripts/lib/validate-docs.js
    - scripts/src/lib/validate-gates.ts
    - scripts/lib/validate-gates.js
    - scripts/src/lib/validate-sections.ts
    - scripts/lib/validate-sections.js
    - scripts/src/lib/validate-structural.ts
    - scripts/lib/validate-structural.js
    - scripts/src/lib/validate.ts
    - scripts/lib/validate.js
    - scripts/src/lib/verification.ts
    - scripts/lib/verification.js
    - test/typescript-module-contract.test.js
    - test/fixtures/typescript-module-contract-mismatch.ts
  scope_evidence:
    producer: graphify
    generated_at: '2026-09-03T14:45:00.000+09:00'
    suggested_paths: []
    # 유효 엔트리 필드: graph, status, query, result — 예시는 주석이라 파싱되지 않는다
    # - graph: source | test | context
    #   status: updated | reused | fail-skip | skip-disabled | missing
    #   query: <graphify 조회>
    #   result: <한 줄 요약>
    # quality/candidates는 graph-suggest 뒤에만 채운다 — scaffold가 제조하지 않는다
    basis:
      - graph: source
        status: reused
        query: CommonJS export equals import require module type contracts
        result: source graph was fresh; suggestion returned 55 candidates before low-confidence filtering
      - graph: test
        status: reused
        query: CommonJS export equals import require module type contracts
        result: test graph was fresh; suggestion returned no retained candidates
      - graph: context
        status: updated
        query: CommonJS export equals import require module type contracts
        result: context graph was rebuilt; suggestion returned no retained candidates
    quality:
      status: low-confidence
      confidence: low
      reasons:
        - 'context seeds: 5 labels, 11 paths'
        - 'relation filter: calls, imports, imports_from (depth <= 2); contains ownership only'
        - 'result explosion: 55 candidates (>= 50)'
    candidates:
      implementation: []
      test: []
      context: []
---
# Tasks

Blueprint: [003](../../index.md)

<!-- scope_evidence.basis 엔트리 필드: graph, status, query, result.
     graph: source | test | context
     status: updated | reused | fail-skip | skip-disabled | missing
     quality/candidates는 graph-suggest 결과로만 채운다(scaffold는 비워 둔다).
     프론트매터 값은 []로 둔다. 이 주석을 실제 엔트리로 옮기면 빈 계획이 승인된다. -->

## Goal & intent
<!-- 구현자가 다른 문서 없이 시작할 수 있게.
     수용 기준과 검증 명령도 여기에 적거나 Checklist에 명시한다. -->
`scripts/src/lib`의 CommonJS 모듈이 `export =`와 `import = require()`를 사용해 공급자 선언을 직접 소비한다. 소비자 캐스트가 가리던 모듈 간 시그니처 불일치는 `tsc --noEmit`에서 실패하고, 방출 JavaScript의 공개 `require()` 형태는 유지한다.

## Interface
<!-- 계약이 리뷰에서 검증 가능하도록 제공하는 것과 거부하는 것을 함께 적습니다. -->
- 제공: 각 변환 대상 모듈의 `module.exports` 계약을 `export =`로 선언하고, 내부 소비자는 `import = require()`로 그 선언을 얻는다.
- 거부: ESM default import/export 전환, `__esModule`·`__importDefault`의 신규 방출, 소비자별 손작성 함수 시그니처 캐스트를 허용하지 않는다.

## Touch
<!-- frontmatter bouncer.affected_paths의 모든 경로가 여기서 정당화되어야 합니다 (G11).
     디렉터리가 아니라 파일 단위로, 동사(Create/Modify/Delete/Rename)를 붙입니다.
     디렉터리 하나로 뭉치면 그 안 모든 파일이 열려 G11이 사실상 통과만 합니다.
     경로는 백틱으로 감쌉니다. -->
- Modify `scripts/src/lib/cli-current-command.ts` — `export =` 계약과 타입 검사되는 내부 소비를 적용한다.
- Modify `scripts/lib/cli-current-command.js` — 빌드가 생성한 CommonJS emit을 소스와 함께 갱신한다.
- Modify `scripts/src/lib/cli-doc-commands.ts` — `export =` 계약과 타입 검사되는 내부 소비를 적용한다.
- Modify `scripts/lib/cli-doc-commands.js` — 빌드가 생성한 CommonJS emit을 소스와 함께 갱신한다.
- Modify `scripts/src/lib/cli-flags.ts` — `export =` 계약과 타입 검사되는 내부 소비를 적용한다.
- Modify `scripts/lib/cli-flags.js` — 빌드가 생성한 CommonJS emit을 소스와 함께 갱신한다.
- Modify `scripts/src/lib/cli-git-commands.ts` — `export =` 계약과 타입 검사되는 내부 소비를 적용한다.
- Modify `scripts/lib/cli-git-commands.js` — 빌드가 생성한 CommonJS emit을 소스와 함께 갱신한다.
- Modify `scripts/src/lib/cli-project-commands.ts` — `export =` 계약과 타입 검사되는 내부 소비를 적용한다.
- Modify `scripts/lib/cli-project-commands.js` — 빌드가 생성한 CommonJS emit을 소스와 함께 갱신한다.
- Modify `scripts/src/lib/cli.ts` — `export =` 계약과 타입 검사되는 내부 소비를 적용한다.
- Modify `scripts/lib/cli.js` — 빌드가 생성한 CommonJS emit을 소스와 함께 갱신한다.
- Modify `scripts/src/lib/codex-agents.ts` — `export =` 계약과 타입 검사되는 내부 소비를 적용한다.
- Modify `scripts/lib/codex-agents.js` — 빌드가 생성한 CommonJS emit을 소스와 함께 갱신한다.
- Modify `scripts/src/lib/commit-guard.ts` — `export =` 계약과 타입 검사되는 내부 소비를 적용한다.
- Modify `scripts/lib/commit-guard.js` — 빌드가 생성한 CommonJS emit을 소스와 함께 갱신한다.
- Modify `scripts/src/lib/commit-hook.ts` — `export =` 계약과 타입 검사되는 내부 소비를 적용한다.
- Modify `scripts/lib/commit-hook.js` — 빌드가 생성한 CommonJS emit을 소스와 함께 갱신한다.
- Modify `scripts/src/lib/commit-sha.ts` — `export =` 계약과 타입 검사되는 내부 소비를 적용한다.
- Modify `scripts/lib/commit-sha.js` — 빌드가 생성한 CommonJS emit을 소스와 함께 갱신한다.
- Modify `scripts/src/lib/commit.ts` — `export =` 계약과 타입 검사되는 내부 소비를 적용한다.
- Modify `scripts/lib/commit.js` — 빌드가 생성한 CommonJS emit을 소스와 함께 갱신한다.
- Modify `scripts/src/lib/comprehension.ts` — `export =` 계약과 타입 검사되는 내부 소비를 적용한다.
- Modify `scripts/lib/comprehension.js` — 빌드가 생성한 CommonJS emit을 소스와 함께 갱신한다.
- Modify `scripts/src/lib/config.ts` — `export =` 계약과 타입 검사되는 내부 소비를 적용한다.
- Modify `scripts/lib/config.js` — 빌드가 생성한 CommonJS emit을 소스와 함께 갱신한다.
- Modify `scripts/src/lib/context-digest.ts` — `export =` 계약과 타입 검사되는 내부 소비를 적용한다.
- Modify `scripts/lib/context-digest.js` — 빌드가 생성한 CommonJS emit을 소스와 함께 갱신한다.
- Modify `scripts/src/lib/current.ts` — `export =` 계약과 타입 검사되는 내부 소비를 적용한다.
- Modify `scripts/lib/current.js` — 빌드가 생성한 CommonJS emit을 소스와 함께 갱신한다.
- Modify `scripts/src/lib/distill.ts` — `export =` 계약과 타입 검사되는 내부 소비를 적용한다.
- Modify `scripts/lib/distill.js` — 빌드가 생성한 CommonJS emit을 소스와 함께 갱신한다.
- Modify `scripts/src/lib/epic-index.ts` — `export =` 계약과 타입 검사되는 내부 소비를 적용한다.
- Modify `scripts/lib/epic-index.js` — 빌드가 생성한 CommonJS emit을 소스와 함께 갱신한다.
- Modify `scripts/src/lib/finalize.ts` — `export =` 계약과 타입 검사되는 내부 소비를 적용한다.
- Modify `scripts/lib/finalize.js` — 빌드가 생성한 CommonJS emit을 소스와 함께 갱신한다.
- Modify `scripts/src/lib/frontmatter.ts` — `export =` 계약과 타입 검사되는 내부 소비를 적용한다.
- Modify `scripts/lib/frontmatter.js` — 빌드가 생성한 CommonJS emit을 소스와 함께 갱신한다.
- Modify `scripts/src/lib/graph-exec.ts` — `export =` 계약과 타입 검사되는 내부 소비를 적용한다.
- Modify `scripts/lib/graph-exec.js` — 빌드가 생성한 CommonJS emit을 소스와 함께 갱신한다.
- Modify `scripts/src/lib/graph-scope.ts` — `export =` 계약과 타입 검사되는 내부 소비를 적용한다.
- Modify `scripts/lib/graph-scope.js` — 빌드가 생성한 CommonJS emit을 소스와 함께 갱신한다.
- Modify `scripts/src/lib/graph-search.ts` — `export =` 계약과 타입 검사되는 내부 소비를 적용한다.
- Modify `scripts/lib/graph-search.js` — 빌드가 생성한 CommonJS emit을 소스와 함께 갱신한다.
- Modify `scripts/src/lib/graphify.ts` — `export =` 계약과 타입 검사되는 내부 소비를 적용한다.
- Modify `scripts/lib/graphify.js` — 빌드가 생성한 CommonJS emit을 소스와 함께 갱신한다.
- Modify `scripts/src/lib/import-git.ts` — `export =` 계약과 타입 검사되는 내부 소비를 적용한다.
- Modify `scripts/lib/import-git.js` — 빌드가 생성한 CommonJS emit을 소스와 함께 갱신한다.
- Modify `scripts/src/lib/import-history.ts` — `export =` 계약과 타입 검사되는 내부 소비를 적용한다.
- Modify `scripts/lib/import-history.js` — 빌드가 생성한 CommonJS emit을 소스와 함께 갱신한다.
- Modify `scripts/src/lib/import-render.ts` — `export =` 계약과 타입 검사되는 내부 소비를 적용한다.
- Modify `scripts/lib/import-render.js` — 빌드가 생성한 CommonJS emit을 소스와 함께 갱신한다.
- Modify `scripts/src/lib/init.ts` — `export =` 계약과 타입 검사되는 내부 소비를 적용한다.
- Modify `scripts/lib/init.js` — 빌드가 생성한 CommonJS emit을 소스와 함께 갱신한다.
- Modify `scripts/src/lib/layout.ts` — `export =` 계약과 타입 검사되는 내부 소비를 적용한다.
- Modify `scripts/lib/layout.js` — 빌드가 생성한 CommonJS emit을 소스와 함께 갱신한다.
- Modify `scripts/src/lib/migrate-ids.ts` — `export =` 계약과 타입 검사되는 내부 소비를 적용한다.
- Modify `scripts/lib/migrate-ids.js` — 빌드가 생성한 CommonJS emit을 소스와 함께 갱신한다.
- Modify `scripts/src/lib/migrate-task-layout.ts` — `export =` 계약과 타입 검사되는 내부 소비를 적용한다.
- Modify `scripts/lib/migrate-task-layout.js` — 빌드가 생성한 CommonJS emit을 소스와 함께 갱신한다.
- Modify `scripts/src/lib/paths.ts` — `export =` 계약과 타입 검사되는 내부 소비를 적용한다.
- Modify `scripts/lib/paths.js` — 빌드가 생성한 CommonJS emit을 소스와 함께 갱신한다.
- Modify `scripts/src/lib/render.ts` — `export =` 계약과 타입 검사되는 내부 소비를 적용한다.
- Modify `scripts/lib/render.js` — 빌드가 생성한 CommonJS emit을 소스와 함께 갱신한다.
- Modify `scripts/src/lib/runtime-state.ts` — `export =` 계약과 타입 검사되는 내부 소비를 적용한다.
- Modify `scripts/lib/runtime-state.js` — 빌드가 생성한 CommonJS emit을 소스와 함께 갱신한다.
- Modify `scripts/src/lib/scaffold.ts` — `export =` 계약과 타입 검사되는 내부 소비를 적용한다.
- Modify `scripts/lib/scaffold.js` — 빌드가 생성한 CommonJS emit을 소스와 함께 갱신한다.
- Modify `scripts/src/lib/schema.ts` — `export =` 계약과 타입 검사되는 내부 소비를 적용한다.
- Modify `scripts/lib/schema.js` — 빌드가 생성한 CommonJS emit을 소스와 함께 갱신한다.
- Modify `scripts/src/lib/scope.ts` — `export =` 계약과 타입 검사되는 내부 소비를 적용한다.
- Modify `scripts/lib/scope.js` — 빌드가 생성한 CommonJS emit을 소스와 함께 갱신한다.
- Modify `scripts/src/lib/seed-worktree.ts` — `export =` 계약과 타입 검사되는 내부 소비를 적용한다.
- Modify `scripts/lib/seed-worktree.js` — 빌드가 생성한 CommonJS emit을 소스와 함께 갱신한다.
- Modify `scripts/src/lib/session-graph.ts` — `export =` 계약과 타입 검사되는 내부 소비를 적용한다.
- Modify `scripts/lib/session-graph.js` — 빌드가 생성한 CommonJS emit을 소스와 함께 갱신한다.
- Modify `scripts/src/lib/subagents.ts` — `export =` 계약과 타입 검사되는 내부 소비를 적용한다.
- Modify `scripts/lib/subagents.js` — 빌드가 생성한 CommonJS emit을 소스와 함께 갱신한다.
- Modify `scripts/src/lib/tasks-docs.ts` — `export =` 계약과 타입 검사되는 내부 소비를 적용한다.
- Modify `scripts/lib/tasks-docs.js` — 빌드가 생성한 CommonJS emit을 소스와 함께 갱신한다.
- Modify `scripts/src/lib/templates.ts` — `export =` 계약과 타입 검사되는 내부 소비를 적용한다.
- Modify `scripts/lib/templates.js` — 빌드가 생성한 CommonJS emit을 소스와 함께 갱신한다.
- Modify `scripts/src/lib/time.ts` — `export =` 계약과 타입 검사되는 내부 소비를 적용한다.
- Modify `scripts/lib/time.js` — 빌드가 생성한 CommonJS emit을 소스와 함께 갱신한다.
- Modify `scripts/src/lib/validate-docs.ts` — `export =` 계약과 타입 검사되는 내부 소비를 적용한다.
- Modify `scripts/lib/validate-docs.js` — 빌드가 생성한 CommonJS emit을 소스와 함께 갱신한다.
- Modify `scripts/src/lib/validate-gates.ts` — `export =` 계약과 타입 검사되는 내부 소비를 적용한다.
- Modify `scripts/lib/validate-gates.js` — 빌드가 생성한 CommonJS emit을 소스와 함께 갱신한다.
- Modify `scripts/src/lib/validate-sections.ts` — `export =` 계약과 타입 검사되는 내부 소비를 적용한다.
- Modify `scripts/lib/validate-sections.js` — 빌드가 생성한 CommonJS emit을 소스와 함께 갱신한다.
- Modify `scripts/src/lib/validate-structural.ts` — `export =` 계약과 타입 검사되는 내부 소비를 적용한다.
- Modify `scripts/lib/validate-structural.js` — 빌드가 생성한 CommonJS emit을 소스와 함께 갱신한다.
- Modify `scripts/src/lib/validate.ts` — `export =` 계약과 타입 검사되는 내부 소비를 적용한다.
- Modify `scripts/lib/validate.js` — 빌드가 생성한 CommonJS emit을 소스와 함께 갱신한다.
- Modify `scripts/src/lib/verification.ts` — `export =` 계약과 타입 검사되는 내부 소비를 적용한다.
- Modify `scripts/lib/verification.js` — 빌드가 생성한 CommonJS emit을 소스와 함께 갱신한다.
- Create `test/typescript-module-contract.test.js` — 의도적인 모듈 경계 시그니처 불일치가 TypeScript에서 거절되는지 검증한다.
- Create `test/fixtures/typescript-module-contract-mismatch.ts` — 정상 빌드 대상 밖에서 불일치 타입을 만드는 컴파일 실패 fixture를 제공한다.

## Do not touch
<!-- 여기 적은 경로가 affected_paths와 겹치면 G12가 막습니다.
     epic / blueprint의 Out of scope에서 이어받습니다. -->
- `tsconfig.json` — 기존 strict·CommonJS emit 설정으로 전환 가능함을 검증한다.
- `scripts/check-emit.js` — 생성물 동기화 검사는 보존한다.
- `package.json` — 새 스크립트나 의존성을 추가하지 않는다.

## Constraints
<!-- 경로로 표현되지 않는, 작업 전체에 걸리는 규칙. 허용된 파일 안에서도 지켜야 합니다.
     예: 하위 호환 별칭을 남기지 않는다 / 기존 게이트 번호와 본문 계약을 유지한다 /
     공개 문자열은 한국어를 유지한다.
     막을 대상이 경로뿐이면 Do not touch에 적습니다. -->
- `scripts/lib`의 각 생성물은 해당 `scripts/src/lib` 소스 변경과 같은 commit에 포함한다.
- 공개 CJS `require()` 호출자와 런타임 반환값을 바꾸지 않는다. `paths`와 `tasks-docs`의 순환 require는 함수 호출 시점 지연을 유지한다.
- 새 의존성, 래퍼, 빌드 설정을 추가하지 않으며 기존 `npm run check:emit`, `npm run typecheck`, `npm test`를 사용한다.

## Checklist
<!-- 각 항목은 구현자가 순서대로 실행 가능해야 합니다.
     행위를 바꾸는 항목은 실패 테스트 → 실패 확인 → 구현 순서로 적습니다.
     기대하는 assertion·상수·명령은 코드블록으로 그대로 적어 해석 여지를 없앱니다.
     blueprint Contract에서 이연된 테스트 본문·구현 시퀀스가 들어올 자리입니다.
     수용 기준·검증 명령을 체크 항목으로 포함하세요. -->
- [ ] 변환 대상의 `module.exports`와 소비자 구조 캐스트 목록을 고정하고, 순환 의존 모듈을 먼저 확인한다.
- [ ] `test/fixtures/typescript-module-contract-mismatch.ts`를 별도 `tsc --noEmit` 호출로 컴파일해 공급자·소비자 시그니처 불일치가 실패하는지 `test/typescript-module-contract.test.js`에서 단언한다.
- [ ] `module.exports`를 `export =`로, 내부 구조 캐스트 require를 `import = require()`로 기계적으로 전환한다.
- [ ] `npm run check:emit`으로 생성된 `scripts/lib` 파일이 소스와 동기화되었는지 확인한다.
- [ ] `npm run verify:strict`를 실행해 공개 CJS 동작과 전체 회귀를 확인한다.
