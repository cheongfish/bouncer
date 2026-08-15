---
type: bouncer.tasks
title: 공통 CI와 coverage 차단선
description: Tasks for 008
resource: .bouncer/context/epics/039-open-source-one-zero/blueprints/001-security-legal-baseline/tasks/008/tasks.md
tags:
  - bouncer
  - tasks
timestamp: '2026-08-15T15:42:17.672+09:00'
bouncer:
  id: TASKS-008
  epic_id: '039'
  blueprint_id: '001'
  status: verified
  verify: npm run ci
  commit_intent:
    - GitLab CI가 빌드 전 emit 드리프트를 검사하지 않고 두 CI가 서로 다른 명령을 실행하고 있음
    - 저장소 소유 ci 명령에 emit·coverage·test·lint·typecheck·audit를 묶어 두 CI가 같은 계약을 강제하게 함
  affected_paths:
    - package.json
    - scripts/check-emit.js
    - .github/workflows/test.yml
    - .gitlab-ci.yml
    - .githooks/pre-commit
    - docs/contributing.md
    - test/ci-contract.test.js
    - test/githooks.test.js
  graph:
    generated_at: '2026-08-15T15:55:18+09:00'
    command: 'graphify query "continuous integration coverage emitted JavaScript lint typecheck audit GitHub GitLab precommit" --graph graphify-out/{source,context}/graph.json'
    suggested_paths:
      - test
    basis:
      - graph: source
        status: reused
        query: continuous integration coverage emitted JavaScript lint typecheck audit GitHub GitLab precommit
        result: '27 nodes; top path: test/cli-project-commands.test.js'
      - graph: context
        status: reused
        query: continuous integration coverage emitted JavaScript lint typecheck audit GitHub GitLab precommit
        result: '0 nodes; no matching context paths'
---
# Tasks

Blueprint: [001](../../index.md)

## Goal & intent
`npm run ci` 하나가 배포 CJS emit, 제품 코드 coverage, test, lint, typecheck,
dependency audit를 순서대로 검사한다. GitHub Actions와 GitLab CI는 `npm ci` 뒤
이 명령만 호출한다. coverage는 vendored third-party와 test를 빼고
`scripts/lib/**`만 측정해 line 94%, branch 83%, function 96%를 하한으로 둔다.

## Interface
- 제공: `check:emit`, `test:coverage`, `ci` package script와 cross-platform
  `scripts/check-emit.js`를 추가한다. 두 CI 설정은 `npm run ci`를 같은 순서로 실행한다.
- 거부: 빌드가 stale emit을 덮은 뒤에야 기준을 잡는 순서, build가 새로 만든
  unstaged·untracked emit 누락, 제품 코드 coverage 94/83/96 미만, high 이상 audit,
  CI별 별도 명령 목록을 거부한다. 이미 index에 stage된 정상 TS/CJS 변경은 허용한다.

## Touch
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

## Do not touch
- `scripts/src/lib` — CI 배선 task에서 제품 동작을 바꾸지 않는다.
- `scripts/lib` — check script 외의 배포 emit을 손으로 고치지 않는다.

## Constraints
- coverage를 맞추기 위해 기존 테스트의 동작 단언을 삭제·skip·완화하지 않는다.
- `check:emit`은 npm과 git을 argv로 실행하고 shell interpolation을 사용하지 않는다.
  `git status --porcelain` 전체를 성공 조건으로 쓰지 않는다. index에 이미 stage된
  정상 emit까지 거부하기 때문이다.
- emit 검사는 테스트·coverage가 build를 실행하기 전에 끝나야 한다.
- coverage는 Node 24 내장 test runner만 사용하고 새 coverage dependency를 추가하지 않는다.
- audit registry가 응답하지 않으면 CI는 성공으로 위장하지 않는다.
- GitHub Actions와 GitLab CI의 차이는 runner 문법뿐이고 검증 명령은 같아야 한다.

## Checklist
- [ ] `test/ci-contract.test.js`를 먼저 추가해 GitLab emit 검사와 공통 진입점
  부재로 실패하는지 확인한다.
- [ ] `scripts/check-emit.js`가 clean tree에서 exit 0, build가 만든 unstaged·untracked
  emit에서 exit 1을 내는 fixture를 `test/ci-contract.test.js`에 추가한다.
- [ ] 서로 일치하는 TS/CJS 변경을 stage한 pre-commit 상황은 exit 0이고, build가
  stage된 CJS를 다시 바꾸면 unstaged diff가 생겨 exit 1인지 단언한다.
- [ ] package scripts를 다음 계약으로 구성한다.
  ```text
  check:emit -> build, then scripts/lib must have no unstaged or untracked emit
  test:coverage -> node --test --experimental-test-coverage
    --test-coverage-include=scripts/lib/**
    --test-coverage-lines=94 --test-coverage-branches=83
    --test-coverage-functions=96
  ci -> check:emit, test:coverage, lint, typecheck, npm audit --audit-level=high
  ```
- [ ] 두 CI를 `npm ci` + `npm run ci`로 맞추고 pre-commit은 `check:emit` + lint만 유지한다.
- [ ] 문서와 contract tests를 새 명령에 맞춘다.
- [ ] `npm run ci`가 통과하고 coverage summary가 최소 94/83/96인지 확인한다.
