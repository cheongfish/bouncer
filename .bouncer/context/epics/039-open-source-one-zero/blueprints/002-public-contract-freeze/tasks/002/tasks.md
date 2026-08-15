---
type: bouncer.tasks
title: 공개 계약 drift 회귀 테스트
description: Tasks for 002
resource: .bouncer/context/epics/039-open-source-one-zero/blueprints/002-public-contract-freeze/tasks/002/tasks.md
tags:
  - bouncer
  - tasks
timestamp: '2026-08-15T18:45:30.065+09:00'
bouncer:
  id: TASKS-002
  epic_id: '039'
  blueprint_id: '002'
  status: verified
  commit_intent:
    - 공개 표면 목록이 구현보다 뒤처져도 아무 검사도 실패하지 않아 계약이 문서 수준의 약속에 머무름
    - 목록과 구현의 이름 집합을 대조해 drift와 결번 코드 재사용을 테스트 실패로 바꿈
  affected_paths:
    - test/public-contract.test.js
    - docs/compatibility.md
    - config.example.json
  graph:
    generated_at: '2026-08-15T18:50:15+09:00'
    command: 'graphify query "public contract compatibility policy CLI command registry gate codes schema version skills list config keys pilot matrix host support docs" --graph graphify-out/{source,context}/graph.json'
    suggested_paths:
      - test
      - docs
    basis:
      - graph: source
        status: reused
        query: public contract compatibility policy CLI command registry gate codes schema version skills list config keys pilot matrix host support docs
        result: '46 nodes; top paths: test/validate-gates.test.js, test/validate-structural.test.js (docs/ is outside config.source_dirs so it cannot appear)'
      - graph: context
        status: updated
        query: public contract compatibility policy CLI command registry gate codes schema version skills list config keys pilot matrix host support docs
        result: '8 nodes; .bouncer/distill/plugin-skills.md and past epic 009/013 docs only; no code target'
---
# Tasks

Blueprint: [002](../../index.md)

## Goal & intent
`docs/compatibility.md`가 선언한 이름 집합이 실제 구현과 어긋나면 `npm test`가
실패한다. 새 CLI 명령을 넣고 문서를 안 고치거나, 문서에서 명령을 지우고 코드를 안
고치면 양쪽 다 잡힌다. `gates.md`가 `S26`을 못 따라간 것 같은 drift가 다시 조용히
쌓이지 않게 하는 것이 이 테스트의 목적이다.

판정 대상은 이름뿐이다. 설명 문장, 표 순서, 링크 형식은 판정하지 않는다. 문서
표현을 고칠 때마다 테스트가 깨지면 사람들이 테스트를 먼저 지운다.

## Interface
- 제공: `test/public-contract.test.js`가 다섯 가지 집합 동등성을 단언한다.
  - CLI: `runCli([])` 사용법에서 뽑은 명령 이름 == 문서의 CLI 목록
  - 스키마: `require('../scripts/lib/schema')`의 `TYPES`·`STATUS_ENUM` 키·
    `SCALE_ENUM`·`AUTONOMY_ENUM`·`BOUNCER_SCHEMA_VERSION` == 문서의 스키마 목록
  - 게이트: `scripts/lib/*.js` 전체에서 발행되는 `G`/`S` 코드 == 문서의 코드 목록
  - 스킬: `skills/` 아래 `bouncer-`로 시작하는 디렉터리 이름 == 문서의 스킬 목록
  - 설정: `config.example.json` 최상위 키 == 문서의 설정 키 목록
  그리고 결번 단언: `G9`·`G15`·`S14`가 구현 코드 집합에도, 문서 목록에도 없다.
- 거부: 문서 설명 문장·표 순서·링크 대상에 대한 단언을 넣지 않는다. 실패 메시지가
  어느 이름이 어느 쪽에만 있는지 말하지 않는 형태(단순 `deepStrictEqual` 없이
  집합 차이를 못 보여주는 단언)를 넣지 않는다.

## Touch
- Create `test/public-contract.test.js` — 위 다섯 집합 동등성과 결번 단언, 그리고
  각 목록 추출 헬퍼를 담는다.

## Do not touch
- `docs/compatibility.md` — task 001이 쓴 정본이다. 테스트를 맞추려고 문서를 고쳐야
  한다면 그건 drift가 아니라 계획 문제이므로 되돌린다.
- `scripts/` — 테스트를 통과시키려고 구현을 바꾸지 않는다.
- `test/open-source-readiness.test.js`, `test/cli-help.test.js`,
  `test/public-name-regression.test.js` — 기존 단언을 이 task로 옮기거나 지우지 않는다.

## Constraints
- Node 24 내장 test runner와 `node:fs`만 쓴다. 마크다운 파서나 스키마 검증
  의존성을 추가하지 않는다.
- 문서에서 이름을 뽑을 때는 지정한 섹션 헤딩 아래의 백틱 토큰만 읽는다. 문서 전체를
  훑으면 산문에 나온 명령 이름까지 목록으로 오인한다.
- 게이트 코드는 emit(`scripts/lib/*.js`) 전체의 인용된 문자열 리터럴에서 뽑는다.
  `validate*`만 보면 `epic-index.js`가 내는 `S13`이 빠져 문서와 테스트가 같이 틀린
  채로 통과한다. 주석이나 메시지 본문의 코드 언급은 집합에 넣지 않는다.
- `capture`는 `test/cli-help.test.js` 안의 파일-지역 함수다. 새 테스트는 자기
  `runCli` 캡처 헬퍼를 직접 정의한다.
- `test/cli-help.test.js`의 `SUBCOMMANDS` 배열은 이름 13개라 `distill`이 빠져 있다.
  이 task는 그 배열을 고치지 않는다. 문서 목록이 정본이고 그 파일은 사용법 출력에
  이름이 나오는지만 보는 별개 검사다.
- 테스트가 실패할 때 어느 쪽에 있고 어느 쪽에 없는지가 메시지에 남아야 한다.
- 기존 테스트의 단언을 완화하거나 skip하지 않는다.

## Checklist
- [ ] 문서 목록 추출 헬퍼를 먼저 쓰고, 일부러 문서 목록에서 명령 하나를 뺀 임시
  입력으로 단언이 실패하는지 확인한다.
- [ ] CLI 집합을 사용법 출력에서 뽑는다. 행 머리의 이름만 읽어 설명 문장의 단어를
  명령으로 오인하지 않는다.
  ```js
  const usage = capture([]).out;
  const cliNames = new Set(
    usage.split('\n')
      .map((l) => /^ {2}(\S+)/.exec(l))
      .filter(Boolean)
      .map((m) => m[1]),
  );
  ```
- [ ] 게이트 코드 집합을 `scripts/lib/*.js` 전체에서 뽑고, `S13`이 들어오는지
  확인한다.
  ```js
  const CODE_LITERAL = /'([GS]\d{1,2})'/g;
  ```
- [ ] 다섯 집합을 각각 정렬 배열로 만들어 `assert.deepStrictEqual`로 비교한다.
- [ ] 결번을 단언한다.
  ```js
  for (const retired of ['G9', 'G15', 'S14']) {
    assert.ok(!implementedCodes.has(retired), `${retired} is retired`);
    assert.ok(!documentedCodes.has(retired), `${retired} must not be re-listed`);
  }
  ```
- [ ] `npm test`가 통과한다.
