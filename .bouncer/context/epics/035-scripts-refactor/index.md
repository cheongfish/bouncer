---
type: bouncer.epic
title: scripts 코어 구조 리팩토링
description: scripts/src/lib의 거대 모듈을 책임 단위로 분해하고 중복 설정 리더를 통합한다
resource: .bouncer/context/epics/035-scripts-refactor/index.md
tags:
  - bouncer
  - epic
timestamp: '2026-08-14T09:53:11.263+09:00'
bouncer:
  id: '035'
  epic_id: '035'
  status: approved
---
# 035 scripts-refactor

## Intent
- 문제: epic 006이 `scripts/`를 TypeScript로 옮겼지만 파일 경계는 CommonJS 시절
  그대로다. `validate.ts` 936줄에 문서 로딩·구조 검사·게이트 판정·섹션 파서가
  같이 있고, `cli.ts` 495줄은 13개 핸들러와 USAGE 문자열을 한 파일에 쥐고 있다.
  설정 파일을 읽어 파싱하는 코드는 여섯 곳에 서로 다른 실패 처리로 복제되어
  있다. 게이트 하나를 고칠 때 읽어야 하는 범위가 파일 전체라 리뷰가 diff만 보고
  판단하지 못한다.
- 목표: 동작을 그대로 둔 채 파일 경계를 책임 단위로 다시 긋고, 설정 리더를
  하나로 모은다. 그 위에서 `strict: true`를 파일 단위로 조인다.

## Success criteria
1. `npm test`가 `test/**` 수정 없이 통과한다.
2. `scripts/lib/<name>.js` 공개 require 경로가 유지된다 — `hooks/`의 네 파일이
   부르는 세 모듈(`commit-hook`, `migrate-ids`, `session-graph`)과 테스트가
   참조하는 모듈 이름, 그리고 각 `module.exports` 키 집합이 그대로다.
3. `bouncer --help` 출력이 커밋 전후 동일하다. 기준선은
   `git show HEAD:scripts/lib/cli.js`로 뜬 사본에서 뽑는다. 개별 명령의
   stdout/stderr는 기존 `test/cli-*.test.js`가 고정한다.
4. `scripts/src/lib/**/*.ts` 중 400줄을 넘는 파일이 없다.
5. `.bouncer/config.json`을 읽어 `JSON.parse`하는 구현이 `scripts/src/lib/config.ts`
   하나뿐이다. 오류를 구분해 던져야 하는 호출자도 그 모듈의 결과 형태를 쓴다.
6. 커밋 후 `npm run build && git diff --exit-code -- scripts/lib`가 깨끗하다.
   이 검사는 `npm test`가 아니라 `.githooks/pre-commit`이 강제한다 — `pretest`의
   `tsc`는 emit을 덮어쓰므로 오래된 커밋 산출을 잡지 못한다. `npm run lint`도
   통과한다.
7. 옮기거나 새로 만든 함수가 내부 로직 블록 단위의 한국어 의도 주석을 갖는다.
   판정은 `bouncer-reviewer`가 diff에서 하며, 다음 줄을 되풀이하는 주석은
   finding으로 잡는다.
8. `tsconfig.json`이 `strict: true`이고 `npm run typecheck`가 통과한다.

## Out of scope
- 기능 추가, 버그 수정, 게이트 코드(G/S) 의미 변경.
- CLI 명령 이름·플래그·출력 형식 변경.
- `.bouncer/` 문서 스키마와 레이아웃 변경.
- `scripts/vendor/`(벤더된 js-yaml)와 `hooks/` 내부 구현.

## Blueprints
* [001 core-module-split](blueprints/001-core-module-split/index.md) - 설정 리더 통합과 `cli.ts`·`validate.ts`·`session-graph.ts`·`import-history.ts` 분해 (`scripts/src/lib/**`, `scripts/lib/**` emit)
