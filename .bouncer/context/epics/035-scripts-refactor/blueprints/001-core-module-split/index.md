---
type: bouncer.blueprint
title: 코어 모듈 분해와 설정 리더 통합
description: cli/validate/session-graph/import-history를 책임 단위로 나누고 config 리더를 하나로 모은다
resource: .bouncer/context/epics/035-scripts-refactor/blueprints/001-core-module-split/index.md
tags:
  - bouncer
  - blueprint
timestamp: '2026-08-14T09:53:11.293+09:00'
bouncer:
  id: '001'
  epic_id: '035'
  blueprint_id: '001'
  status: approved
  commit_type: refactor
  scale: full
---
# 001 core-module-split

Epic: [035](../../index.md)

## Intent
- 문제: 네 파일이 저장소 코어 로직의 절반을 차지한다 — `validate.ts` 936줄,
  `cli.ts` 495줄, `session-graph.ts` 481줄, `import-history.ts` 522줄. 그리고
  `.bouncer/config.json`을 읽어 파싱하는 코드가 `cli`·`init`·`session-graph`·
  `subagents`·`graphify`·`verification` 여섯 곳에 서로 다른 실패 처리(`{}` /
  `null` / 타입 있는 예외)로 복제되어 있다.
- 완료 조건: 위 네 파일이 책임 단위 형제 모듈로 나뉘고, 설정 파싱 구현이
  하나만 남고, 공개 require 경로와 CLI 출력과 테스트는 그대로다.

## Contract
- 인터페이스: 새 공개 인터페이스는 `scripts/lib/config.js`의 두 함수다.
  `readConfigResult(repoRoot)`는 `{ ok: true, value }` 또는
  `{ ok: false, reason: 'missing' | 'invalid' }`를 돌려준다(`missing`은 ENOENT일
  때만). `readConfig(repoRoot)`는 그 위에 얹혀 파싱된 값 또는 `null`을 돌려주며
  절대 throw하지 않는다. 두 함수 모두 값의 모양을 검사하지 않는다 — 객체 여부
  판정은 지금 그것을 하는 호출자(`init`)에 남는다.
- 데이터·상태: 없음. 문서 스키마, 게이트 코드, 파일 레이아웃, 설정 키 모두
  그대로다.
- 수용 기준: epic 성공 기준 1~7. (8번 `strict: true`는 이 blueprint 밖이다.)
- 검증 명령: `npm test`. emit이 소스와 맞는지는 `npm test`가 아니라
  `.githooks/pre-commit`이 본다 — `pretest`의 `tsc`가 `scripts/lib`를 덮어쓰므로
  테스트만으로는 오래된 커밋 산출을 잡지 못한다.
- 실패 모드·엣지 케이스:
  - `require('../vendor/js-yaml')`의 상대 경로는 **emit 위치** 기준이다. 분해된
    모듈을 하위 디렉터리에 두면 이 경로가 깨진다 — 분해는 평평한 형제 모듈로만
    하고, yaml 접근은 지금처럼 `frontmatter.ts` / `render.ts`에만 남긴다.
  - `scope.ts`는 `validate → finalize` 순환을 끊으려 분리된 모듈이다. 분해가
    새 순환(예: `validate-gates` → `validate` → `validate-gates`)을 만들면 안 된다.
  - `test/public-name-regression.test.js`의 allowlist는 레거시 `.sdd` 문자열을
    가진 파일명을 고정 나열한다. 그 문자열은 `validate.ts`의
    `validateBlueprint` 안에 있으므로 이 함수는 `validate.ts`에 남긴다. 다른
    파일로 옮기면 allowlist가 깨지고 테스트 무수정 기준도 함께 깨진다.
  - `test/distribution.test.js`가 `scripts/`·`hooks/`의 모든 `.js`에 bare
    require 금지를 건다. 새 모듈도 상대 경로와 `node:` 내장만 쓴다.
  - 소스 파일이 늘면 emit 파일도 같은 수로 늘어난다. `affected_paths`에
    `scripts/src/lib/*.ts`와 `scripts/lib/*.js`를 **쌍으로** 넣지 않으면
    commit-safety가 커밋을 막는다.
  - 설정 리더 통합은 실패 처리 의미가 호출자마다 다르다. `null`과 `{}`를
    뭉개면 `graphify.enabled` 판정이나 승격 no-op 경로가 조용히 바뀐다.
    `verification.ts`는 더 나아가 파일 없음(`VERIFY_CONFIG_MISSING`)과 깨진
    JSON(`VERIFY_CONFIG_INVALID`)을 구분해 던지므로, 삼키는 리더로 바꾸면 그
    구분이 사라진다 — 이래서 `readConfigResult`가 따로 있다.
  - 커밋 안전 훅은 **설치된 플러그인 캐시**의 코드로 돈다. 네 task 모두
    `scripts/lib`에 새 파일을 더하므로, 캐시가 오래된 상태면 스코프 판정이
    어긋나 정상 커밋이 막힐 수 있다. 막히면 워크트리 자신의 `readAffectedPaths`로
    스코프를 먼저 확인하고, 훅을 우회하기 전에 원인을 확정한다.

## Out of scope
- `strict: true` 조이기 — 이 epic의 다음 blueprint.
- `hooks/**`, `scripts/vendor/**`, `.bouncer/` 문서와 스키마.
- 게이트 코드(G/S) 추가·삭제·의미 변경, 새 CLI 명령.
- 테스트 단언 수정. 단언을 고쳐야 초록이 된다면 순수 리팩토링이 아니다.

## One-commit justification
- 한 커밋이 아니라 한 blueprint 4커밋이다. 파일 경계 이동은 diff가 크고
  `git`이 rename으로 접지 못해, 네 갈래(설정 / CLI / validate / graph·import)를
  한 커밋에 담으면 리뷰어가 "옮기기만 했는가"를 판정할 수 없다. task마다
  독립적으로 `npm test`가 초록이므로 커밋 단위로 잘라도 중간 상태가 깨지지
  않는다. blueprint는 그대로 PR 하나다.

## Documents
* [Tasks 001](tasks/001/tasks.md) - 설정 리더 통합 ([검증](tasks/001/verification.md) / [리뷰](tasks/001/review.md))
* [Tasks 002](tasks/002/tasks.md) - `cli.ts` 커맨드 레지스트리 분해 ([검증](tasks/002/verification.md) / [리뷰](tasks/002/review.md))
* [Tasks 003](tasks/003/tasks.md) - `validate.ts` 분해 ([검증](tasks/003/verification.md) / [리뷰](tasks/003/review.md))
* [Tasks 004](tasks/004/tasks.md) - `session-graph.ts`·`import-history.ts` 분해 ([검증](tasks/004/verification.md) / [리뷰](tasks/004/review.md))
* [Context review](context-review.md) - 계획 문서 정합성 판정
