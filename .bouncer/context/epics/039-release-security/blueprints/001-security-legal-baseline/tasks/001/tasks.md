---
type: bouncer.tasks
title: 런타임 벤더 취약점 제거
description: Task specification for the 039 release security work
resource: .bouncer/context/epics/039-release-security/blueprints/001-security-legal-baseline/tasks/001/tasks.md
tags:
  - bouncer
  - tasks
timestamp: '2026-08-15T15:37:30.959+09:00'
bouncer:
  id: TASKS-001
  epic_id: '039'
  blueprint_id: '001'
  status: verified
  verify: npm run verify:security
  commit_intent:
    - 저장소 입력을 읽는 런타임 벤더가 high 등급 CPU 고갈 취약 버전이라 공개 배포를 막고 있음
    - 개발 의존성과 벤더 복사본을 안전 버전으로 맞추고 바이트 드리프트를 테스트로 차단함
  affected_paths:
    - package.json
    - package-lock.json
    - scripts/vendor/js-yaml.js
    - scripts/vendor/README.md
    - test/distribution.test.js
  graph:
    generated_at: '2026-08-15T15:55:18+09:00'
    command: 'graphify query "dependency security js-yaml vendor npm audit distribution" --graph graphify-out/{source,context}/graph.json'
    suggested_paths:
      - test
      - .bouncer/context/epics/033-quality-security
      - .bouncer/context/epics/033-quality-security/blueprints/001-context-review-guard
    basis:
      - graph: source
        status: reused
        query: dependency security js-yaml vendor npm audit distribution
        result: '48 nodes; top paths: test/cli-project-commands.test.js, test/distribution.test.js, test/smoke.test.js'
      - graph: context
        status: reused
        query: dependency security js-yaml vendor npm audit distribution
        result: '6 nodes; top paths: epic 033 index and context-review-guard explain'
---
# 작업

Blueprint: [001](../../index.md)

## 목표와 의도
`js-yaml`을 `4.3.1` 이상으로 올리고 `brace-expansion`을 `5.0.9` 이상으로
해결해 `npm audit --audit-level=high`를 통과한다. 런타임
`scripts/vendor/js-yaml.js`는 설치된 `js-yaml/dist/js-yaml.js`와 바이트 단위로
같아야 한다. `npm install`을 실행하지 않는 플러그인 런타임 계약은 유지한다.

## 인터페이스
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

## 체크리스트
- [ ] `test/distribution.test.js`에 버전 비교와 바이트 동일성 실패 테스트를 먼저
  추가한다.
  ```js
  assert.ok(compareVersion(installedVersion, '4.3.1') >= 0);
  assert.deepStrictEqual(vendoredBytes, installedDistBytes);
  assert.match(vendorReadme, new RegExp(`\\| ${installedVersion} \\| MIT \\|`));
  ```
- [ ] `node --test test/distribution.test.js`가 현재 4.3.0 벤더에서 실패하는지 확인한다.
- [ ] `js-yaml@^4.3.1`로 package와 lockfile을 갱신하고, lockfile의
  `brace-expansion`이 `5.0.9` 이상인지 확인한다.
- [ ] `verify:security`가 `npm test` 뒤 `npm audit --audit-level=high`를 실행하게 한다.
- [ ] 설치된 `dist/js-yaml.js`를 벤더 파일로 복사하고 README 버전을 맞춘다.
- [ ] `node --test test/distribution.test.js`와 `npm run verify:security`를 실행한다.
