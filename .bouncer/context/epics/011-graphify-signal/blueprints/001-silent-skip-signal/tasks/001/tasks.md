---
type: bouncer.tasks
title: 그래프 누락 스코프를 반환 필드로 싣고 훅 경고와 스킬 스킵 조건을 그 위에 세움
description: missing 필드, 경고 문구 생성 함수, graphify-runner 스킵 조건 정정
resource: .bouncer/context/epics/011-graphify-signal/blueprints/001-silent-skip-signal/tasks/001/tasks.md
tags:
  - bouncer
  - tasks
timestamp: '2026-08-04T15:34:53.539+09:00'
bouncer:
  id: TASKS-001
  epic_id: '011'
  blueprint_id: '001'
  status: verified
  affected_paths:
    - scripts/src/lib/session-graph.ts
    - scripts/lib/session-graph.js
    - hooks/session-graph.js
    - skills/graphify-runner/SKILL.md
    - test/session-graph.test.js
    - test/skill-graphify-runner.test.js
  graph:
    generated_at: '2026-08-04T15:42:55+09:00'
    command: graphify query (source + context)
    suggested_paths:
      - scripts/src/lib
      - scripts/lib
      - hooks
      - test
      - skills
    basis: graph-sync가 source·context를 재빌드했다(context는 이 계획 문서 때문에 stale). source 질의 "syncSessionGraphs planOneGraph planSessionGraph session-graph hook"은 session-graph.ts/js를 중심으로 cli·init·time을 돌려줬다. cli는 graph-sync 명령의 호출자일 뿐 반환 객체를 그대로 직렬화하므로 새 필드가 배선 없이 흘러나가 Do not touch로 내렸고, init은 BP-002의 대상이라 같은 이유로 제외했다. time은 부트스트랩 타임스탬프 경로라 무관하다. hooks/session-graph.js는 질의에 직접 나오지 않았는데, 훅이 require 한 줄로만 라이브러리에 붙어 있어 간선이 얇기 때문이다 — 이 blueprint가 옮기려는 것이 바로 그 훅 안의 문구라 수동으로 넣었다. context 질의 "graphify runner skip condition graph availability suggested paths basis"는 EPIC-011 자신만 집었다. 선행 스트림이 없다는 뜻이고 discovery의 Overlap "none"과 일치한다. skills는 config.source_dirs(scripts/hooks/test) 밖이라 수동으로 보탰다.
---
# Tasks

Blueprint: [001](index.md)

## Goal & intent
`bouncer graph-sync`가 그래프를 만들지 못한 스코프를 `missing` 배열로 함께 돌려준다.
SessionStart 훅은 그 결정을 사람이 읽을 경고로 바꿔 stderr에 출력하며, 문구를 훅 안에서
만들지 않고 라이브러리가 준 배열을 그대로 쓴다. `graphify-runner`는 source `graph.json`
부재만으로 우아한 스킵을 결정한다 — context 그래프가 있어도 소스 질의를 대신하지 않는다.
판정 로직(신선도, 빌드 대상 선정, 부트스트랩 처리)은 바뀌지 않는다. 검증은 `npm test`.

## Interface
- 제공: `syncSessionGraphs(...)`의 반환에 `missing: string[]`. 그래프 작업을 수행한
  경우에만 채우며, 각 스코프의 `graph.json`이 동기화 후에도 없으면 그 스코프 이름이
  들어간다. `resolveGraphScopes` 순서(`source`, `context`)를 따른다.
- 제공: `planOneGraph`가 돌려주는 항목에 `configured: string[]`. 설정에 적힌 디렉터리
  전체이며, 기존 `dirs`는 실재하는 것만 담는 현재 의미를 유지한다.
- 제공: `session-graph`가 `graphSyncWarnings(decision) -> string[]`을 내보낸다. 경고가
  없으면 빈 배열. 다루는 상황은 부트스트랩 `partial` / `legacy`, `skip-no-graphify`,
  `missing`에 담긴 스코프, `failed`에 담긴 스코프 네 가지다. 각 줄은 개행으로 끝난다.
- 제공: `hooks/session-graph.js`가 `graphSyncWarnings`의 결과만 stderr로 쓴다. 훅 안에
  경고 문자열 리터럴을 남기지 않는다.
- 거부: `graphify.enabled`가 `false`이거나 부트스트랩이 `partial`/`legacy`라 그래프
  작업을 하지 않은 경우 `missing`은 빈 배열이다. 수행하지 않은 일을 누락으로 보고하지
  않는다.
- 거부: 스코프의 `dirs`가 비어 `skip-no-dirs`가 된 경우에도 `ok`는 `true`이고 종료
  코드는 `0`이다. 그래프 부재는 오류가 아니라 상태다.
- 거부: `graphify-runner`는 source `graph.json`이 없으면 `suggested_paths`를 추론으로
  채우지 않는다. 스캐폴드 기본값 `[]`을 남기고 사용자 확인을 요구한다.

## Touch
- Modify `scripts/src/lib/session-graph.ts` — `planOneGraph`에 `configured` 추가,
  `syncSessionGraphs`에 `missing` 계산 추가, `graphSyncWarnings` 신설과 export.
- Modify `scripts/lib/session-graph.js` — 위 소스의 빌드 산출물. `npm run build`
  (`pretest`)로 재생성해 커밋한다. 손으로 편집하지 않는다.
- Modify `hooks/session-graph.js` — 인라인 경고 분기를 `graphSyncWarnings` 호출과
  출력 루프로 교체한다. `exit 0`과 예외 삼킴은 그대로 둔다.
- Modify `skills/graphify-runner/SKILL.md` — 2단계 Availability check의 스킵 조건을
  source `graph.json` 부재 기준으로 고치고, 판단 근거가 `graph-sync`의 `missing`임을
  명시한다.
- Modify `test/session-graph.test.js` — `missing`, `configured`, `graphSyncWarnings`의
  단위 테스트를 더한다.
- Modify `test/skill-graphify-runner.test.js` — 새 스킵 조건 문구에 대한 단언을 더하고,
  "both" 기준을 검사하던 단언이 있으면 교체한다.

## Do not touch
- `scripts/src/lib/init.ts` — `source_dirs` 기본값은 002가 다룬다.
- `scripts/src/lib/cli.ts` — `graph-sync`는 반환 객체를 그대로 직렬화하므로 `missing`이
  배선 없이 흘러나온다. 명령 표면을 건드릴 이유가 없다.
- `scripts/src/lib/validate.ts` — 게이트 판정은 이 변경과 무관하다.
- `scripts/src/lib/commit-hook.ts`, `hooks/commit-safety.js` — 커밋 가드는 별개 경로다.
- `.bouncer/config.json` 및 `scripts/src/lib/schema.ts` — 새 설정 키를 만들지 않는다.

## Constraints
- 신선도 판정과 빌드 대상 선정 로직을 바꾸지 않는다. `planSessionGraph`의 기존 테스트가
  수정 없이 통과해야 하며, 그것이 이 커밋의 경계다.
- `scripts/lib/*.js`는 `npm run build` 산출물이다. 소스는 항상 `scripts/src/**`.
- 훅은 어떤 입력에서도 세션을 막지 않는다 — 경고 생성이 던져도 `exit 0`이다.
- 경고는 **stderr**로만 나간다. stdout은 파이프 청정을 유지한다.
- 공개 문자열은 기존 관례대로 영어를 유지한다 (`hooks/session-graph.js`의 현행 문구).
- 스킬 본문은 현행 언어(영어)를 유지한다.
- 새 런타임 의존성을 추가하지 않는다 (Node 표준 라이브러리 + 벤더링 `js-yaml`).
- `missing`은 파일 시스템을 다시 훑어 판단한다. `action` 문자열로 추정하지 않는다 —
  이전 세션이 남긴 `graph.json`이 있으면 `skip-no-dirs`여도 누락이 아니다.

## Checklist
- [ ] `test/session-graph.test.js`에 실패 테스트를 먼저 추가하고 `npm test`로 **예상된
      이유로** 실패하는지 확인한다.
      ```js
      // 옵트인 + source 디렉터리 없음 → missing에 source
      assert.deepStrictEqual(result.missing, ['source']);
      // 옵트인 안 함 → 누락 보고 없음
      assert.deepStrictEqual(disabled.missing, []);
      // 설정 전체가 configured에 남는다
      assert.deepStrictEqual(src.configured, ['src', 'test']);
      assert.deepStrictEqual(src.dirs, ['src']);
      ```
- [ ] `scripts/src/lib/session-graph.ts`의 `planOneGraph`에 `configured: dirs`를 추가한다.
      `dirs: present`의 현재 의미는 건드리지 않는다.
- [ ] `syncSessionGraphs`에서 빌드 루프가 끝난 뒤 `missing`을 계산한다. 그래프 작업을
      하지 않은 결정(`skip-graph-disabled`, `skip-partial-bootstrap`,
      `skip-legacy-bootstrap`, `skip-no-graphify`)에서는 빈 배열로 둔다. 그 외에는
      스코프별 `graph.json` 존재를 실제로 확인한다.
      ```js
      const missing = decision.graphs
        .filter((g) => graphMtime(g.outDir) === null)
        .map((g) => g.name);
      ```
      `graphMtime`은 지금 `planSessionGraph`가 `deps`로 받는 것과 같은 주입 지점을 쓴다.
      테스트가 파일 시스템 없이 이 분기를 덮을 수 있어야 한다.
- [ ] `graphSyncWarnings(decision)`를 추가하고 export한다. 네 상황을 이 순서로 만든다.
      ```
      partial  : 'Bouncer: partial Bouncer state detected; …'
      legacy   : 'Bouncer: legacy state detected; …'
      no-graphify : 현행 문구 유지 (pip install graphifyy / docs/install.md 포함)
      missing  : 스코프별 한 줄. source면 configured 목록을 문구에 넣는다.
      failed   : 현행 문구 유지
      ```
      누락 경고는 무엇을 설정했는지 보여야 한다. 예:
      ```
      Bouncer: graphify is enabled but no source graph was built — none of
      source_dirs ["src","test"] exist. Update .bouncer/config.json; path
      suggestions will fall back to manual affected_paths.
      ```
- [ ] `graphSyncWarnings`의 단위 테스트를 더한다. 최소한 아래를 덮는다.
      ```js
      assert.deepStrictEqual(graphSyncWarnings({ action: 'skip-graph-disabled', missing: [] }), []);
      assert.match(graphSyncWarnings(noDirs)[0], /source_dirs/);
      assert.match(graphSyncWarnings(noDirs)[0], /"src"/);
      assert.strictEqual(graphSyncWarnings(healthy).length, 0);
      ```
- [ ] `hooks/session-graph.js`의 `if/else if` 사슬을 교체한다.
      ```js
      for (const line of graphSyncWarnings(decision)) process.stderr.write(line);
      ```
      `try/catch`와 `process.exit(0)`은 그대로 둔다.
- [ ] `skills/graphify-runner/SKILL.md` 2단계의 "**both** `graph.json` files are still
      missing after sync"를 source 기준으로 고친다. 판단 근거가 `graph-sync` 출력의
      `missing`임을 적고, context 그래프만 있는 상태가 스킵을 막지 않는다는 점을
      한 문장으로 남긴다. 3단계의 "If one graph file is missing, query the other" 문장이
      새 조건과 모순되지 않는지 확인하고 필요하면 함께 고친다.
- [ ] `test/skill-graphify-runner.test.js`에 새 조건 단언을 더한다.
      ```js
      assert.match(md, /missing/);
      assert.doesNotMatch(md, /both `graph\.json` files/);
      ```
- [ ] 통합 확인: `graphify.enabled: true`, `source_dirs`를 실재하지 않는 값으로 둔 임시
      저장소에서 `bouncer graph-sync`가 `"missing": ["source"]`를 출력하고, 같은 상태로
      훅에 `{"cwd":"<repo>"}`를 물리면 stderr에 경고가 나오는지 확인한다.
- [ ] `npm test`가 통과할 때까지 마무리한다. `pretest`가 `scripts/lib/*.js`를 재생성하므로
      산출물 diff가 함께 남는지 확인한다.
