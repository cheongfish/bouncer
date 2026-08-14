---
type: bouncer.tasks
title: 설정 파일 리더 단일화
description: 여러 곳에 복제된 .bouncer/config.json 파서를 config 모듈 하나로 모은다
resource: .bouncer/context/epics/035-scripts-refactor/blueprints/001-core-module-split/tasks/001/tasks.md
tags:
  - bouncer
  - tasks
timestamp: '2026-08-14T09:53:11.293+09:00'
bouncer:
  id: TASKS-001
  epic_id: '035'
  blueprint_id: '001'
  status: verified
  commit_intent:
    - 설정 파일을 읽는 코드가 여러 곳에 서로 다른 실패 처리로 복제되어 있어, 한쪽만 고치면 나머지가 조용히 어긋남
    - 파싱은 한 곳으로 모으고 없음·깨짐을 어떻게 받을지는 호출 지점이 정하게 함
  affected_paths:
    - scripts/src/lib/config.ts
    - scripts/src/lib/cli.ts
    - scripts/src/lib/subagents.ts
    - scripts/src/lib/session-graph.ts
    - scripts/src/lib/graphify.ts
    - scripts/src/lib/init.ts
    - scripts/src/lib/verification.ts
    - scripts/lib/config.js
    - scripts/lib/cli.js
    - scripts/lib/subagents.js
    - scripts/lib/session-graph.js
    - scripts/lib/graphify.js
    - scripts/lib/init.js
    - scripts/lib/verification.js
  graph:
    generated_at: '2026-08-14T10:05:38.205+09:00'
    command: graphify query "validateBlueprint checkGate checkStructural runCli parseFlags syncSessionGraphs planImport readConfig" --graph graphify-out/{source,context}/graph.json
    suggested_paths:
      - scripts/src/lib
      - scripts/lib
      - test
    basis:
      - graph: source
        status: reused
        query: validateBlueprint checkGate checkStructural runCli parseFlags syncSessionGraphs planImport readConfig
        result: 46 nodes; scripts/src/lib/cli.ts, scripts/src/lib/validate.ts, scripts/lib/cli.js 중심. 그래프에 이미 제거된 cmdAdvise 노드가 남아 있어 source 그래프가 최신이 아님 — 힌트로만 쓴다.
      - graph: context
        status: updated
        query: scripts 코어 모듈 분해 리팩토링 TypeScript 구조
        result: 4 nodes; epic 006-scripts-typescript와 이번 035 인덱스만. 코드 경로 힌트 없음.
---
# Tasks

Blueprint: [001](../../index.md)

## Goal & intent
`.bouncer/config.json`을 읽어 `JSON.parse`하는 구현이 저장소에 하나만 남는다.
지금은 일곱 자리가 같은 파일을 연다 — `cli.ts`의 `readConfig`, `subagents.ts`의
`readConfig`, `session-graph.ts`의 `readBouncerConfig`, `graphify.ts`의
`readConfigSafe`, `init.ts`의 `readConfigObject`와 `inspectBootstrap` 안의 인라인
파싱, 그리고 `verification.ts`의 인라인 파싱이다. 실패했을 때 무엇을 하는지는
자리마다 다르다: `{}`를 주는 곳, `null`을 주는 곳, 그리고 파일 없음과 깨진
JSON을 구분해 타입 있는 예외를 던지는 곳(`verification.ts`). 파싱은 한 곳으로
모으고, 그 차이는 호출 지점에 남긴다.

동작은 관측 가능한 범위에서 바뀌지 않는다. 특히 잘못된 `config.json`(배열,
원시값, 깨진 JSON, 권한 오류)에서 지금 나오는 결과가 그대로 나와야 한다.

## Interface
- 제공: `scripts/src/lib/config.ts`가 두 함수를 export한다.
  - `readConfigResult(repoRoot)` → `{ ok: true, value }` 또는
    `{ ok: false, reason: 'missing' | 'invalid' }`. `missing`은 읽기 오류
    `code`가 `ENOENT`일 때만이고, 그 밖의 읽기 오류와 JSON 파싱 실패는 모두
    `invalid`다(현재 `verification.ts`의 분기와 같은 경계).
  - `readConfig(repoRoot)` → `readConfigResult`의 `value`, 실패면 `null`.
- 거부: 두 함수 모두 값의 **모양**을 검사하지 않는다. 파싱된 것이 배열이든
  숫자든 그대로 통과시킨다 — 지금 `cli`·`subagents`·`session-graph`가 그렇게
  동작하고 있고, 여기서 객체 검사를 넣으면 그 세 곳의 동작이 조용히 바뀐다.
  객체 여부 판정은 지금 그것을 하는 `init.ts` 호출 지점에 남긴다.
- 거부: `{}` 기본값, 기본 설정 주입, 스키마 검증, 캐싱은 이 모듈이 하지 않는다.
  「없음」과 「빈 설정」을 같게 보려는 호출자는 `readConfig(root) ?? {}`로 받는다.

## Touch
- Create `scripts/src/lib/config.ts` — `readConfigResult`·`readConfig` 단일
  구현과, 왜 `missing`이 ENOENT만인지·왜 모양 검사를 하지 않는지를 적은 주석.
- Modify `scripts/src/lib/cli.ts` — 로컬 `readConfig` 삭제, `config`에서 가져와
  `?? {}`로 받는다. `cmdCurrent --set`의 `base_branch` 읽기 동작 유지.
- Modify `scripts/src/lib/subagents.ts` — 로컬 `readConfig` 삭제, 같은 방식으로
  교체. `resolveSubagentModel`이 여전히 throw하지 않는 것이 핵심.
- Modify `scripts/src/lib/session-graph.ts` — `readBouncerConfig`를 삭제하고
  `readConfig`로 교체. 이쪽은 `null`을 그대로 쓰므로 `?? {}`를 붙이지 않는다.
- Modify `scripts/src/lib/graphify.ts` — `readConfigSafe`를 삭제하고 `readConfig`로
  교체한다. 반환 계약(`null`)이 이미 같으므로 호출부는 그대로다.
- Modify `scripts/src/lib/init.ts` — `readConfigObject`를 삭제하고 `readConfig`로
  교체하되, 객체 여부 판정(`typeof === 'object'`, 배열 아님)은 호출 지점에
  남긴다. `inspectBootstrap`의 인라인 파싱도 `readConfig`를 거치게 하고,
  유효성 판정(`source_dirs` 배열, `verify`·`base_branch` 문자열)은 그대로 둔다.
- Modify `scripts/src/lib/verification.ts` — 인라인 `JSON.parse`를
  `readConfigResult`로 바꾸고, `reason`을 기존 오류로 매핑한다:
  `missing` → `VERIFY_CONFIG_MISSING`, `invalid` → `VERIFY_CONFIG_INVALID`.
  메시지 문자열과 `config.verify` 검사는 그대로 둔다.
- Create `scripts/lib/config.js` — 위 소스의 `tsc` emit.
- Modify `scripts/lib/cli.js` — emit.
- Modify `scripts/lib/subagents.js` — emit.
- Modify `scripts/lib/session-graph.js` — emit.
- Modify `scripts/lib/graphify.js` — emit.
- Modify `scripts/lib/init.js` — emit.
- Modify `scripts/lib/verification.js` — emit.

## Do not touch
- `test/**` — 이 task는 순수 리팩토링이다. 테스트를 고쳐야 초록이 되면 통합이
  틀린 것이다.
- `.bouncer/config.json` — 설정 값과 키를 바꾸지 않는다.
- `scripts/vendor/**` — 벤더 코드는 그대로 둔다.
- `hooks/**` — 훅은 emit된 모듈의 공개 이름만 부르며, 그 이름은 바뀌지 않는다.

## Constraints
- 옮기거나 새로 만드는 함수는 내부의 의미 있는 로직 블록(가드, 분기, 루프,
  누적, 조기 반환)마다 한국어 주석을 단다. 주석은 다음 줄이 이미 말하는
  *무엇*이 아니라 *왜*를 적는다 — 이 순서여야 하는 이유, 이 값을 거르는 이유,
  이 분기를 만들게 한 실패 사례, 의도적으로 하지 않은 선택. 특히 이 task에서는
  각 호출 지점이 `null`을 어떻게 받는지(`?? {}` 여부)와 그 이유를 호출 지점에
  적는다. 자명한 한 줄은 주석이 필요 없다.
- 실패 처리 의미를 뭉개지 않는다. `session-graph`의 `graphify.enabled` 판정과
  `init`의 승격 no-op 경로는 `null`을 구분해서 쓰고 있고, `verification`은 파일
  없음과 깨진 JSON을 서로 다른 오류로 던진다.
- `verification.ts`의 `readVerifyCommand` 경로는 이 task에서 계약이 바뀌지
  않는다. 바꾸는 것은 config를 읽는 방법뿐이고, `bouncer.verify` 해석 순서와
  `isValidVerifyCommand` 재사용은 그대로다.
- `config.ts`는 `node:fs`·`node:path`만 쓴다. 다른 `scripts/lib` 모듈을
  require하지 않는다(모두가 이 모듈을 부르므로 순환의 시작점이 되면 안 된다).
- 하위 호환 별칭(`readBouncerConfig`, `readConfigObject`)을 남기지 않는다.
- 공개 `module.exports` 키 집합은 각 모듈에서 그대로다. `config`는 새 모듈이다.
- 커밋 전에 `npm run build`로 emit을 갱신해 `scripts/lib`가 소스와 일치하게 한다.

## Checklist
- [ ] `scripts/src/lib/config.ts`를 만들고 `readConfigResult`·`readConfig`를
      구현한다. 계약: ENOENT → `{ ok: false, reason: 'missing' }`, 그 밖의 읽기
      오류와 JSON 오류 → `{ ok: false, reason: 'invalid' }`, 성공 →
      `{ ok: true, value }`. 모양 검사는 하지 않는다.
- [ ] `cli.ts`의 로컬 `readConfig`(주석 포함)를 지우고
      `const { readConfig } = require('./config');`로 바꾼 뒤, 사용처를
      `readConfig(repoRoot) ?? {}`로 받는다.
- [ ] `subagents.ts`의 로컬 `readConfig`를 같은 방식으로 교체한다.
      `resolveSubagentModel`이 config 부재 시 `{ model: null, provider: ... }`를
      돌려주는 경로가 유지되는지 확인한다.
- [ ] `session-graph.ts`의 `readBouncerConfig`를 지우고 호출부
      (`realGraphifyEnabled`, `realSourceDirs`, `realContextDirs`)를 `readConfig`로
      돌린다. `cfg?.` 옵셔널 체이닝이 `null`을 받는 전제를 유지한다.
- [ ] `graphify.ts`의 `readConfigSafe`를 지우고 `readConfig`로 돌린다. 이 함수의
      주석("파일 없음·깨진 JSON·권한 오류 모두 config 없음과 같게")이 담고 있던
      의도는 `config.ts` 주석으로 옮긴다.
- [ ] `init.ts`의 `readConfigObject`를 지우고 `readConfig` + 호출 지점 객체
      검사로 돌린다. `inspectBootstrap`의 인라인 `JSON.parse`도 같은 함수를 쓰되,
      `'ready' | 'partial' | 'missing' | 'legacy'` 반환 값은 그대로다.
- [ ] `verification.ts`의 인라인 파싱을 `readConfigResult`로 돌린다. 잘못된
      config에서 던지는 오류 코드가 전과 같은지 직접 확인한다 — 파일을 지우면
      `VERIFY_CONFIG_MISSING`, 파일에 `{`만 남기면 `VERIFY_CONFIG_INVALID`.
- [ ] 저장소에 `.bouncer/config.json`을 직접 파싱하는 코드가 하나뿐인지 확인한다:
      ```bash
      grep -rn "JSON.parse" scripts/src/lib | grep -i config
      ```
      히트는 `scripts/src/lib/config.ts` 안의 것뿐이어야 한다. `config.json`
      문자열 자체는 `init.ts`가 설정 파일을 **쓰는** 경로에도 남는다 — 그건
      파싱이 아니므로 이 검사 대상이 아니다.
- [ ] `npm run build && git diff --exit-code -- scripts/lib`가 커밋 후 깨끗한지
      확인한다(빌드 산출을 함께 스테이징).
- [ ] `npm test`가 `test/**` 수정 없이 통과한다.
- [ ] `npm run lint`가 통과한다.
