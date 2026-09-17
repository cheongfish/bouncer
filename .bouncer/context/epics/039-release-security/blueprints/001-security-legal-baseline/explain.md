---
type: bouncer.explain
title: 001 설명
description: Explanation for the 039 release security blueprint
resource: .bouncer/context/epics/039-release-security/blueprints/001-security-legal-baseline/explain.md
tags:
  - bouncer
  - explain
timestamp: '2026-08-15T18:22:40.424+09:00'
bouncer:
  id: EXPLAIN-001
  epic_id: '039'
  blueprint_id: '001'
  status: published
  comprehension:
    - range_from: develop
      range_to: 0c611712170ddc00ad7747af5da01c4551ef788d
      diff_sha: 9b4c4a0cb7cd8c463e7d545196c65534f4fe0a1eeb02042d896e26671545a51c
      quiz_score: 5/5
      disposition: 벤더 바이트 동일·Apache-2.0·기본 strict·통합 ci·coverage 하한을 모두 맞춤
      recorded_at: '2026-08-15T18:23:51+09:00'
---
# 설명

## 배경
공개 전에 런타임 벤더(`scripts/vendor/js-yaml.js`)가 high 취약 버전에 묶여 있었고,
루트에 Apache-2.0·보안 제보·기여 규칙이 없었다. TypeScript는 암시적 any를 허용했고,
GitHub와 GitLab은 서로 다른 검사 명령을 돌렸다. 이 blueprint는 벤더를 안전 버전과
바이트 단위로 맞추고, 라이선스·거버넌스 문서를 고정하고, `scripts/src` 전체를
`strict: true`로 올린 뒤, `npm run ci` 하나로 emit·coverage·lint·typecheck·audit를
묶어 두 CI가 같은 계약을 강제하게 한다.

## 직관
배포본·타입·CI가 세 갈래로 새지 않게, 한 저장소 명령으로 막는 공개 차단선이다.

## 코드
- `scripts/vendor/js-yaml.js` + `test/distribution.test.js` — 설치본과 바이트 동일, 최소 4.3.1
- `LICENSE`, `SECURITY.md`, `CODE_OF_CONDUCT.md`, `docs/contributing.md`,
  `test/open-source-readiness.test.js` — Apache-2.0과 공개 거버넌스
- `tsconfig.json` (`strict: true`), `eslint.config.js` (`typescript-eslint`) —
  전 제품 TypeScript 소스
- `scripts/check-emit.js`, `package.json`의 `ci` / `test:coverage`,
  `.github/workflows/test.yml`, `.gitlab-ci.yml`, `.githooks/pre-commit`,
  `test/ci-contract.test.js` — 공통 CI와 로컬 pre-commit(emit+lint)

## 퀴즈
1. 런타임 벤더 보안을 닫을 때 이 blueprint가 강제하는 핵심 계약은?
   - A) `package-lock.json`만 안전하면 `scripts/vendor`는 그대로 둬도 된다
   - B) 설치된 `js-yaml` dist와 `scripts/vendor/js-yaml.js`가 바이트 단위로 같고 최소 4.3.1이다
   - C) `npm audit`가 vendor 디렉터리를 직접 스캔한다

2. 저장소 라이선스와 `package.json` SPDX는?
   - A) Apache-2.0, `package.json`에도 `Apache-2.0`을 둔다
   - B) MIT, `package.json`에는 license 필드를 두지 않는다
   - C) Unlicense, NOTICE만 루트에 둔다

3. TypeScript 기본 설정은 이 blueprint 이후 무엇이 맞나?
   - A) 기본 `tsconfig.json`은 `strict: false`이고 `tsconfig.strict.json`만 strict다
   - B) typecheck는 건너뛰고 ESLint만 켠다
   - C) 기본 `tsconfig.json`이 `strict: true`이며 임시 `tsconfig.strict.json`은 제거됐다

4. `npm run ci`가 묶는 순서와 두 CI의 호출 방식은?
   - A) `check:emit` → `test:coverage` → `lint` → `typecheck` → `npm audit --audit-level=high`이고, 두 CI는 `npm ci` 뒤 `npm run ci`만 호출한다
   - B) GitHub는 `npm test`, GitLab은 `npm run lint`만 호출한다
   - C) coverage를 먼저 돌린 뒤 emit을 검사한다

5. coverage 하한의 측정 범위와 수치는?
   - A) 저장소 전체, line 80%
   - B) `scripts/vendor/**`만, function 100%
   - C) `scripts/lib/**`만, line 94% / branch 83% / function 96%

## 이해 상태
- 점수: 5/5
- 정답: 1B, 2A, 3C, 4A, 5C
- 응답: 1B, 2A, 3C, 4A, 5C
- 채점: 전부 정답
- disposition: 벤더 바이트 동일·Apache-2.0·기본 strict·통합 ci·coverage 하한을 모두 맞춤
- range: develop..0c611712170ddc00ad7747af5da01c4551ef788d
- diff_sha: 9b4c4a0cb7cd8c463e7d545196c65534f4fe0a1eeb02042d896e26671545a51c

## Tasks

### Task 001

#### Interface

- 제공: `package.json`이 안전한 `js-yaml` 최소 버전과 `verify:security` script를
  선언하고 lockfile이 high 취약점 없는 해석 결과를 고정한다.
  `test/distribution.test.js`는 설치본과 벤더 파일의 바이트 및 README 버전 표기가
  일치하는지 단언한다.
- 거부: `js-yaml < 4.3.1`, `brace-expansion < 5.0.9`, 설치본과 다른 벤더 파일,
  벤더 버전과 다른 README 표기, high 이상 `npm audit` 결과는 검증 실패다.

## 변경 범위
- Modify `package.json` — `js-yaml` 최소 버전을 `^4.3.1`로 올리고
  `verify:security`를 `npm test` + high audit wrapper로 추가한다.
- Modify `package-lock.json` — `js-yaml`과 `brace-expansion`을 취약하지 않은 해석
  결과와 integrity로 고정하고 의도하지 않은 lockfile churn은 되돌린다.
- Modify `scripts/vendor/js-yaml.js` — 설치된 안전 버전의 UMD bundle로 교체한다.
- Modify `scripts/vendor/README.md` — 실제 벤더 버전과 갱신·검사 절차를 기록한다.
- Modify `test/distribution.test.js` — 안전 최소 버전, 설치본-벤더 바이트 동일성,
  README 버전 동일성을 단언한다.

## 변경 금지
- `scripts/src/lib/frontmatter.ts` — YAML 파싱 계약은 바꾸지 않는다.
- `scripts/src/lib/render.ts` — YAML 렌더 계약은 바꾸지 않는다.
- `scripts/vendor/js-yaml.LICENSE` — 4.3.1의 MIT 전문과 현재 파일이 같으면 불필요한
  재기록을 하지 않는다.

## 제약 조건
- 런타임 `dependencies`를 추가하지 않는다. 플러그인은 clone 직후 `node_modules`
  없이 실행돼야 한다.
- 벤더 파일은 published package의 `dist/js-yaml.js`를 수정 없이 복사한다.
- advisory 동작을 로컬 패치하지 않고 upstream 수정 버전을 사용한다.
- 네트워크 audit를 실행하지 못하면 성공으로 간주하지 않는다.

### Task 002

#### Interface

- 제공: 루트 `LICENSE`의 Apache-2.0 전문, `SECURITY.md`의 지원 버전·비공개
  신고·응답 범위, `CODE_OF_CONDUCT.md`의 행동 및 집행 기준, 기여물이
  Apache-2.0으로 제공된다는 `docs/contributing.md` 규칙을 추가한다.
- 거부: 보안 취약점을 일반 공개 이슈로 받는 안내, npm 게시 안내, 미검증 버전을
  지원한다고 읽히는 문구, 기존 제3자 라이선스 고지 삭제를 허용하지 않는다.

## 변경 범위
- Create `LICENSE` — 변경하지 않은 Apache License 2.0 전문을 둔다.
- Create `SECURITY.md` — 최신 릴리스 지원 범위, 비공개 신고 주소, 초기 응답과
  공개 조율 원칙을 적는다.
- Create `CODE_OF_CONDUCT.md` — Contributor Covenant 2.1 전문과 기존 author
  email 기반 집행 연락처를 둔다.
- Modify `README.md` — 라이선스 미지정 문구를 Apache-2.0 링크로 바꾸고 보안 신고와
  행동강령 진입점을 추가한다.
- Modify `docs/contributing.md` — 기여물의 Apache-2.0 제공, 행동강령, 보안 제보
  분리 규칙을 추가한다.
- Modify `package.json` — `license`, `repository`, `homepage`, `bugs`, `engines`를
  실제 Git 플러그인 배포와 Node 24 요구사항에 맞춘다.
- Create `test/open-source-readiness.test.js` — 루트 정책 파일과 package SPDX,
  README 링크, 제3자 고지 보존을 단언한다.

## 변경 금지
- `scripts/vendor/js-yaml.LICENSE` — js-yaml MIT 고지를 유지한다.
- `skills/stop-slop/LICENSE` — 반입 스킬의 MIT 고지를 유지한다.
- `skills/agentic-code-benchmark/NOTICE.md` — Apache-2.0 반입 출처를 유지한다.
- `plugin.json` — 플러그인 매니페스트 스키마에 확인되지 않은 license 키를 넣지 않는다.

## 제약 조건
- Apache-2.0 전문과 Contributor Covenant 2.1 전문은 공식 원문을 임의 번역하거나
  요약하지 않는다.
- 보안 연락처는 이미 매니페스트에 공개된 author email을 재사용하고 새 개인정보를
  추가하지 않는다.
- `private: true`는 유지한다. 이 필드는 npm 오게시를 막으며 오픈소스 라이선스와
  충돌하지 않는다.
- 저작권 소유자를 추정한 `NOTICE`를 만들지 않는다.

### Task 003

#### Interface

- 제공: 함수 매개변수·반환값·문서 frontmatter·경로 값에 명시적 타입을 부여하고,
  `tsconfig.strict.json`의 `npm run typecheck:strict` 진입점과
  `typescript-eslint` 기반 TypeScript lint를 추가한다.
- 거부: 암시적 `any`, 근거 없는 `any`, `@ts-ignore`, 이중 assertion으로 오류를
  숨기는 방식, 공개 export 이름·값 변경을 허용하지 않는다.

## 변경 범위
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

## 변경 금지
- `test` — 타입 주석 때문에 동작 단언을 바꾸지 않는다.
- `hooks` — 공개 CommonJS export 소비자는 그대로 둔다.
- `tsconfig.json` — 전체 strict 전환은 TASKS-007이 맡는다.

## 제약 조건
- CommonJS `require`·`module.exports`와 파일 이름을 유지한다.
- 외부 입력은 `unknown`에서 검증해 좁히고, 내부 편의를 위해 `any`로 풀지 않는다.
- 타입 전용 변경으로 게이트 코드·오류 문구·JSON 형태를 바꾸지 않는다.
- 소스를 고친 뒤 `npm run build`로 emit을 함께 커밋한다.
- TypeScript용 core `no-undef`·`no-unused-vars`는 끄고 대응하는
  `typescript-eslint` 규칙을 사용한다. recommended 규칙 자체를 통째로 끄지 않는다.

### Task 004

#### Interface

- 제공: 문서 leaf·task unit·finding·gate context·실패 엔트리의 타입과 narrowing을
  추가하고 `tsconfig.strict.json` include를 이 모듈군까지 넓힌다.
- 거부: 게이트/구조 코드, status enum, 실패 문구, scaffold 산출물, verification
  증적 형태 변경과 타입 오류 은폐를 허용하지 않는다.

## 변경 범위
- Modify `tsconfig.strict.json` — 문서·검증 모듈을 누적 include한다.
- Modify `eslint.config.js` — 같은 모듈군을 TypeScript lint 대상에 누적한다.
- Modify `scripts/src/lib/epic-index.ts` — epic 목록과 OKF 행 파싱 타입을 고정한다.
- Modify `scripts/src/lib/scaffold.ts` — scaffold 입력·문서 데이터·쓰기 결과 타입을 고정한다.
- Modify `scripts/src/lib/verification.ts` — 설정 오류·명령 결과·증적 데이터 타입을 고정한다.
- Modify `scripts/src/lib/validate-sections.ts` — section·path·finding 파서 타입을 고정한다.
- Modify `scripts/src/lib/validate-docs.ts` — 문서 leaf와 task unit 타입을 고정한다.
- Modify `scripts/src/lib/validate-structural.ts` — Distill·graph·OKF 구조 입력을 좁힌다.
- Modify `scripts/src/lib/validate-gates.ts` — gate context와 실패 엔트리 타입을 고정한다.
- Modify `scripts/src/lib/validate.ts` — validate 오케스트레이션 입력·출력을 고정한다.
- Modify `scripts/lib/epic-index.js` — TypeScript 변경의 CJS emit을 동기화한다.
- Modify `scripts/lib/scaffold.js` — TypeScript 변경의 CJS emit을 동기화한다.
- Modify `scripts/lib/verification.js` — TypeScript 변경의 CJS emit을 동기화한다.
- Modify `scripts/lib/validate-sections.js` — TypeScript 변경의 CJS emit을 동기화한다.
- Modify `scripts/lib/validate-docs.js` — TypeScript 변경의 CJS emit을 동기화한다.
- Modify `scripts/lib/validate-structural.js` — TypeScript 변경의 CJS emit을 동기화한다.
- Modify `scripts/lib/validate-gates.js` — TypeScript 변경의 CJS emit을 동기화한다.
- Modify `scripts/lib/validate.js` — TypeScript 변경의 CJS emit을 동기화한다.

## 변경 금지
- `test` — 기존 판정 단언을 타입 작업에 맞춰 약화하지 않는다.
- `skills` — 워크플로 의미는 BP002까지 유지한다.
- `tsconfig.json` — 전체 strict 전환은 TASKS-007이 맡는다.

## 제약 조건
- `module.exports` 키 집합과 require 경로를 유지한다.
- 잘못된 문서가 지금 실패하는 코드와 메시지를 유지한다.
- optional 문서와 손상된 JSON의 기존 fail-open/fail-closed 경계를 바꾸지 않는다.
- 타입 전용 helper는 한 파일에서만 쓰면 그 파일 안에 둔다.

### Task 005

#### Interface

- 제공: current pointer, Git adapter, staged result, commit/finalize result,
  migration plan, worktree seed 결과에 명시적 타입을 부여하고 strict include를 넓힌다.
- 거부: Git 명령 순서, dry-run/`--yes` 의미, 스테이징 허용 경로, 포인터 위치,
  마이그레이션 all-or-nothing 계약 변경을 허용하지 않는다.

## 변경 범위
- Modify `tsconfig.strict.json` — Git 생명주기 모듈을 누적 include한다.
- Modify `eslint.config.js` — 같은 모듈군을 TypeScript lint 대상에 누적한다.
- Modify `scripts/src/lib/runtime-state.ts` — git-common-dir 포인터 IO와 deps 타입을 고정한다.
- Modify `scripts/src/lib/current.ts` — pointer·candidate·task selection 타입을 고정한다.
- Modify `scripts/src/lib/commit-hook.ts` — shell token·alias·commit 판정 타입을 고정한다.
- Modify `scripts/src/lib/commit-guard.ts` — 스코프 판정 입력·출력 타입을 고정한다.
- Modify `scripts/src/lib/commit.ts` — task commit 입력·Git adapter·결과 타입을 고정한다.
- Modify `scripts/src/lib/finalize.ts` — remainder staging·lock·next 결과 타입을 고정한다.
- Modify `scripts/src/lib/seed-worktree.ts` — worktree Git adapter와 seed 결과 타입을 고정한다.
- Modify `scripts/src/lib/comprehension.ts` — diff hash·comprehension entry 타입을 고정한다.
- Modify `scripts/src/lib/migrate-ids.ts` — migration 발견·계획·적용 타입을 고정한다.
- Modify `scripts/src/lib/migrate-task-layout.ts` — task layout migration 타입을 고정한다.
- Modify `scripts/lib/runtime-state.js` — TypeScript 변경의 CJS emit을 동기화한다.
- Modify `scripts/lib/current.js` — TypeScript 변경의 CJS emit을 동기화한다.
- Modify `scripts/lib/commit-hook.js` — TypeScript 변경의 CJS emit을 동기화한다.
- Modify `scripts/lib/commit-guard.js` — TypeScript 변경의 CJS emit을 동기화한다.
- Modify `scripts/lib/commit.js` — TypeScript 변경의 CJS emit을 동기화한다.
- Modify `scripts/lib/finalize.js` — TypeScript 변경의 CJS emit을 동기화한다.
- Modify `scripts/lib/seed-worktree.js` — TypeScript 변경의 CJS emit을 동기화한다.
- Modify `scripts/lib/comprehension.js` — TypeScript 변경의 CJS emit을 동기화한다.
- Modify `scripts/lib/migrate-ids.js` — TypeScript 변경의 CJS emit을 동기화한다.
- Modify `scripts/lib/migrate-task-layout.js` — TypeScript 변경의 CJS emit을 동기화한다.

## 변경 금지
- `hooks` — 설치 호스트 adapter는 공개 CJS 표면을 그대로 소비한다.
- `test` — Git 호출 순서와 결과 단언을 약화하지 않는다.
- `tsconfig.json` — 전체 strict 전환은 TASKS-007이 맡는다.

## 제약 조건
- `execFileSync`·파일시스템 주입점은 기존 테스트가 넣는 fake를 그대로 받는다.
- destructive Git·파일 작업의 기존 guard와 실행 순서를 바꾸지 않는다.
- catch 값은 `unknown`에서 `Error`/NodeJS 오류로 좁힌다.
- 타입 전용 변경으로 새로운 Git 명령이나 플래그를 추가하지 않는다.

### Task 006

#### Interface

- 제공: Distill shard/index/route, graph plan/result, init result, CLI IO/handler의
  타입을 정의하고 strict include를 `scripts/src/lib/**/*.ts` 전체로 확장한다.
- 거부: CLI 명령·플래그·출력, Distill fail-open 규칙, graph status 어휘,
  init idempotency, provider fallback 변경과 타입 오류 은폐를 허용하지 않는다.

## 변경 범위
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

## 변경 금지
- `test` — CLI·Distill·graph 단언을 타입 작업에 맞춰 변경하지 않는다.
- `skills` — 워크플로의 graph/Distill 호출 순서는 유지한다.
- `tsconfig.json` — 기본 strict 전환은 TASKS-007이 맡는다.

## 제약 조건
- stdout JSON과 stderr 진단 분리를 유지한다.
- graphify 부재·오래된 그래프·불확실한 Distill route의 기존 fail-open을 유지한다.
- CLI handler 공통 타입이 순환 require나 새 런타임 모듈을 만들지 않게 type-only로 둔다.
- 전체 strict 통과를 위해 테스트나 컴파일 옵션을 느슨하게 하지 않는다.

### Task 007

#### Interface

- 제공: `tsconfig.json.compilerOptions.strict === true`; 기본 build와 typecheck가
  전체 소스 strict 오류에서 non-zero로 종료한다.
- 거부: 별도 strict include에만 의존하는 상태, `strictNullChecks` 등 하위 옵션
  재비활성화, 소스 제외·`any`·ignore로 통과시키는 방식을 허용하지 않는다.

## 변경 범위
- Modify `tsconfig.json` — `strict`를 `true`로 바꾼다.
- Delete `tsconfig.strict.json` — 단계적 전환용 임시 config를 제거한다.
- Modify `package.json` — 임시 `typecheck:strict`를 제거하고 `verify:strict`가 기본
  `typecheck`를 사용하게 바꾼다.
- Modify `eslint.config.js` — `parserOptions.project`를 삭제한 임시 config 대신
  `./tsconfig.json`으로 바꾼다. 규칙 집합은 바꾸지 않는다.

## 변경 금지
- `scripts/src/lib` — 앞선 네 task에서 strict와 lint를 통과한 소스를 다시 고치지 않는다.
- `scripts/lib` — config 전환은 새 emit diff를 만들지 않는다.
- `test` — 타입 config 전환을 위해 동작 단언을 바꾸지 않는다.

## 제약 조건
- `include`는 `scripts/src/lib/**/*.ts`를 유지한다.
- `skipLibCheck` 등 strict와 무관한 compiler option을 이 커밋에서 바꾸지 않는다.
- `npm run build` 후 `scripts/lib` diff가 없어야 한다.

### Task 008

#### Interface

- 제공: `check:emit`, `test:coverage`, `ci` package script와 cross-platform
  `scripts/check-emit.js`를 추가한다. 두 CI 설정은 `npm run ci`를 같은 순서로 실행한다.
- 거부: 빌드가 stale emit을 덮은 뒤에야 기준을 잡는 순서, build가 새로 만든
  unstaged·untracked emit 누락, 제품 코드 coverage 94/83/96 미만, high 이상 audit,
  CI별 별도 명령 목록을 거부한다. 이미 index에 stage된 정상 TS/CJS 변경은 허용한다.

## 변경 범위
- Modify `package.json` — `check:emit`, `test:coverage`, `ci` script와 94/83/96
  threshold를 선언한다.
- Create `scripts/check-emit.js` — build 후 index 대비 새로 생긴 unstaged 변경은
  `git diff --exit-code -- scripts/lib`로, untracked emit은
  `git ls-files --others --exclude-standard -- scripts/lib`로 검사한다. 둘 중 하나라도
  있으면 non-zero로 종료하고 이미 stage된 emit은 허용한다.
- Modify `.github/workflows/test.yml` — `npm ci` 뒤 `npm run ci`만 호출한다.
- Modify `.gitlab-ci.yml` — GitHub와 같은 `npm run ci` 계약을 호출한다.
- Modify `.githooks/pre-commit` — 중복 shell 구현 대신 `npm run check:emit`을 재사용한다.
- Modify `docs/contributing.md` — 로컬 검증 명령, coverage 범위·하한, audit의
  네트워크 요구사항, 두 CI의 동일 계약을 문서화한다.
- Create `test/ci-contract.test.js` — package scripts와 두 CI·pre-commit이 같은
  진입점을 쓰는지, threshold가 94/83/96인지 단언한다.
- Modify `test/githooks.test.js` — pre-commit의 공통 emit script 호출을 단언한다.

## 변경 금지
- `scripts/src/lib` — CI 배선 task에서 제품 동작을 바꾸지 않는다.
- `scripts/lib` — check script 외의 배포 emit을 손으로 고치지 않는다.

## 제약 조건
- coverage를 맞추기 위해 기존 테스트의 동작 단언을 삭제·skip·완화하지 않는다.
- `check:emit`은 npm과 git을 argv로 실행하고 shell interpolation을 사용하지 않는다.
  `git status --porcelain` 전체를 성공 조건으로 쓰지 않는다. index에 이미 stage된
  정상 emit까지 거부하기 때문이다.
- emit 검사는 테스트·coverage가 build를 실행하기 전에 끝나야 한다.
- coverage는 Node 24 내장 test runner만 사용하고 새 coverage dependency를 추가하지 않는다.
- audit registry가 응답하지 않으면 CI는 성공으로 위장하지 않는다.
- GitHub Actions와 GitLab CI의 차이는 runner 문법뿐이고 검증 명령은 같아야 한다.
