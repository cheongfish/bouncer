---
type: bouncer.tasks
title: 타입 소스를 추가하고 CommonJS 산출·기존 require 경로를 유지함
description: Tasks for 001
resource: .bouncer/context/epics/006-scripts-typescript/blueprints/001-tsc-cjs-migrate/tasks.md
tags:
  - bouncer
  - tasks
timestamp: '2026-08-03T04:04:55.505Z'
bouncer:
  id: TASKS-001
  epic_id: '006'
  blueprint_id: '001'
  status: verified
  affected_paths:
    - scripts/
    - package.json
    - package-lock.json
    - tsconfig.json
    - test/master-rules.test.js
    - test/public-name-regression.test.js
  graph:
    generated_at: '2026-08-03T04:05:30.000Z'
    command: graphify query
    suggested_paths:
      - scripts/
      - package.json
    basis: graphify query "TypeScript migration scripts lib cli bouncer tsc commonjs package.json tsconfig"; BFS from scripts rolled up to scripts/ and package.json. tsconfig.json is new (not in graph); seed manually into affected_paths with user confirm. hooks/test left out of suggestions — require paths must keep working without rewriting them.
---
# Tasks

Blueprint: [001](index.md)

## Goal & intent
`scripts/` 결정적 코어를 TypeScript 소스로 옮기고 `tsc`로 CommonJS를
`scripts/lib/`에 낸다. bin·훅·테스트의 기존 `require('…/scripts/lib/…')`와
CLI·게이트 동작은 그대로 둔다. 검증: `npm run typecheck`와 `npm test`.

## Interface
- 제공: `scripts/src/lib/*.ts` 소스; `tsc` → `scripts/lib/*.js`(CJS, 커밋);
  `tsconfig.json`; `package.json`의 `build` / `typecheck`와 테스트 전 빌드;
  `typescript`·`@types/node` devDependency.
- 거부: ESM 전환; `tsx`/Bun 등 TS 직접 실행; `scripts/vendor/` 본문 수정;
  CLI·게이트·export 이름·동작 변경; 산출 없이 소스만 배포하는 경로.
- 유지: `scripts/bouncer` → `require('./lib/cli')`; 훅·테스트의
  `../scripts/lib/<module>` require; `npm test`가 verify 명령으로 통과.

## Touch
- Create `tsconfig.json` — `rootDir`/`outDir`로 `scripts/src` → `scripts/lib`,
  `module: commonjs`, Node 타입 포함
- Modify `package.json` — devDependencies·`build`/`typecheck`·테스트 전 빌드
- Modify `package-lock.json` — lockfile for typescript/@types/node
- Create `scripts/src/lib/advisor.ts` — `advisor.js` 이전
- Create `scripts/src/lib/cli.ts` — `cli.js` 이전
- Create `scripts/src/lib/commit-guard.ts` — `commit-guard.js` 이전
- Create `scripts/src/lib/commit-hook.ts` — `commit-hook.js` 이전
- Create `scripts/src/lib/current.ts` — `current.js` 이전
- Create `scripts/src/lib/finalize.ts` — `finalize.js` 이전
- Create `scripts/src/lib/frontmatter.ts` — `frontmatter.js` 이전
- Create `scripts/src/lib/init.ts` — `init.js` 이전
- Create `scripts/src/lib/layout.ts` — `layout.js` 이전
- Create `scripts/src/lib/paths.ts` — `paths.js` 이전
- Create `scripts/src/lib/render.ts` — `render.js` 이전
- Create `scripts/src/lib/runtime-state.ts` — `runtime-state.js` 이전
- Create `scripts/src/lib/scaffold.ts` — `scaffold.js` 이전
- Create `scripts/src/lib/schema.ts` — `schema.js` 이전
- Create `scripts/src/lib/session-graph.ts` — `session-graph.js` 이전
- Create `scripts/src/lib/templates.ts` — `templates.js` 이전
- Create `scripts/src/lib/validate.ts` — `validate.js` 이전
- Create `scripts/src/lib/verification.ts` — `verification.js` 이전
- Modify `scripts/lib/advisor.js` — 산출로 교체(손작성 제거)
- Modify `scripts/lib/cli.js` — 산출로 교체
- Modify `scripts/lib/commit-guard.js` — 산출로 교체
- Modify `scripts/lib/commit-hook.js` — 산출로 교체
- Modify `scripts/lib/current.js` — 산출로 교체
- Modify `scripts/lib/finalize.js` — 산출로 교체
- Modify `scripts/lib/frontmatter.js` — 산출로 교체
- Modify `scripts/lib/init.js` — 산출로 교체
- Modify `scripts/lib/layout.js` — 산출로 교체
- Modify `scripts/lib/paths.js` — 산출로 교체
- Modify `scripts/lib/render.js` — 산출로 교체
- Modify `scripts/lib/runtime-state.js` — 산출로 교체
- Modify `scripts/lib/scaffold.js` — 산출로 교체
- Modify `scripts/lib/schema.js` — 산출로 교체
- Modify `scripts/lib/session-graph.js` — 산출로 교체
- Modify `scripts/lib/templates.js` — 산출로 교체
- Modify `scripts/lib/validate.js` — 산출로 교체
- Modify `scripts/lib/verification.js` — 산출로 교체
- Modify `scripts/bouncer` — 필요 시 shebang/`require('./lib/cli')`만 유지 확인
  (동작 변경 없음)
- Modify `test/master-rules.test.js` — Superpowers 네거티브 어서션이
  public-name 스캐너에 걸리지 않도록 리터럴을 분리 구성(사용자 승인 범위 확장)
- Modify `test/public-name-regression.test.js` — `LEGACY_ALLOWLIST`에
  `scripts/src/lib/schema.ts`·`validate.ts` 추가(기존 `.js` 검출기와 동일 본문)

## Do not touch
- `hooks/` — PreToolUse 등 훅 본문은 JS 유지; require 대상만 산출로 충족
- `skills/` — 스킬 마크다운·셸의 require 경로 문구 유지
- `docs/` — 아키텍처/기여 가이드 전면 개편 없음
- `.bouncer/config.json` — `verify` 문자열은 `npm test` 유지(빌드는
  package 스크립트 쪽에 흡수)

## Constraints
- CommonJS only. `"type":"module"` 추가 금지. 소스는 `export =` /
  `import x = require` 또는 동등 CJS emit이 나는 형태.
- `scripts/vendor/` 본문 불변. vendor는 상대 require로 두고, 필요하면
  `scripts/src` 쪽 선언 파일만 추가.
- 새 런타임 의존성 금지. 추가 허용: `typescript`, `@types/node` (dev only).
  `tsx`/Bun/빌드 오케스트레이터 금지 — `tsc`만.
- 게이트 코드·CLI 플래그·exit code·export 이름·사용자 메시지 의미 변경 금지.
- 산출 `.js`는 커밋한다. 소스만 커밋하고 소비자에게 `tsc`를 요구하지 않는다.
- Minimality: 경로 alias·모노레포 도구·점진적 `allowJs` 이중 소스 장기 유지
  없이, `scripts/src` → emit `scripts/lib` 한 줄로 끝낸다.
- 테스트 스위트 TS/ESM 전환 금지. 허용 테스트 수정은 (1) master-rules
  네거티브 리터럴 분리 (2) legacy allowlist에 TS 소스 경로 추가뿐.

## Checklist
- [ ] `tsconfig.json` 추가: `compilerOptions.module` = `commonjs`,
      `rootDir` = `scripts/src`, `outDir` = `scripts/lib`, strict에 가깝게,
      `skipLibCheck`로 vendor 마찰 최소화
- [ ] `package.json`에 `typescript`·`@types/node` 추가 및 스크립트:
      ```json
      "build": "tsc",
      "typecheck": "tsc --noEmit",
      "pretest": "npm run build",
      "test": "node --test"
      ```
      (`pretest`가 어려우면 `test`가 build를 포함해도 됨. `verify`는 계속
      `npm test`)
- [ ] 각 `scripts/lib/*.js`(vendor 제외)를 `scripts/src/lib/*.ts`로 옮긴다.
      동작 동일, 타입만 보강. `require`/`module.exports` 계약 유지
- [ ] vendor 참조가 깨지면 선언 파일만 추가하고 `scripts/vendor/js-yaml.js`는
      수정하지 않는다
- [ ] `npm run build`로 `scripts/lib/*.js`를 재생성한다. 손작성 `.js`와 산출이
      섞이지 않게 한다
- [ ] `scripts/bouncer`가 여전히 `./lib/cli`를 require하고 서브커맨드가 동작하는지
      스모크한다:
      ```bash
      node scripts/bouncer --help
      ```
- [ ] `test/master-rules.test.js`의 `/superpowers/i` 리터럴을
      `new RegExp(['super', 'powers'].join(''), 'i')`로 바꿔
      `public-name-regression` 자기참조 실패를 해소한다(어서션 의미 동일)
- [ ] `test/public-name-regression.test.js`의 `LEGACY_ALLOWLIST`에
      `scripts/src/lib/schema.ts`와 `scripts/src/lib/validate.ts`를 추가한다
- [ ] 수용: epic Success criteria 1–4
- [ ] 검증:
      ```bash
      npm run typecheck
      npm test
      ```
