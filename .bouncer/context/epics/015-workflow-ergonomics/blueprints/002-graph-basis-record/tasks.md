---
type: bouncer.tasks
title: basis 엔트리 리스트를 검증·스캐폴드·기록 절차에 반영함
description: graph.basis 레코드 스키마와 다섯 값 status enum
resource: .bouncer/context/epics/015-workflow-ergonomics/blueprints/002-graph-basis-record/tasks.md
tags:
  - bouncer
  - tasks
timestamp: '2026-08-06T09:12:53.161+09:00'
bouncer:
  id: TASKS-002
  epic_id: '015'
  blueprint_id: '002'
  status: verified
  affected_paths:
    - scripts/src/lib/validate.ts
    - scripts/lib/validate.js
    - scripts/src/lib/scaffold.ts
    - scripts/lib/scaffold.js
    - skills/graphify-runner/SKILL.md
    - skills/bouncer-plan/SKILL.md
    - test/validate-structural.test.js
    - test/validate-gates.test.js
    - test/scaffold.test.js
    - test/skill-graphify-runner.test.js
    - test/skill-bouncer-plan.test.js
    - docs/gates.md
    - docs/ARCHITECTURE.md
    - docs/troubleshooting.md
  graph:
    generated_at: '2026-08-06T09:31:32+09:00'
    command: graphify query (source + context graphs)
    suggested_paths:
      - scripts/src/lib
      - scripts/lib
      - test
      - skills/graphify-runner
      - skills/bouncer-plan
      - docs
    basis: 'graph-sync rebuilt the context graph (built: context; source already fresh; failed: none). Source query "graph basis suggested_paths validate scaffold gate G4 S9 graphify runner" returned scripts/src/lib + scripts/lib (cli, init, session-graph, time) and test/validate-gates.test.js — the graph reaches the sync/CLI side but not validate.ts itself, so the validate/scaffold pair was pinned by reading the S9 and G4 call sites directly (validate.ts:117 and :355). Context query returned the 011-graphify-signal epic index, the blueprint that introduced basis. skills/ and docs/ were added by hand because config.source_dirs is scripts/hooks/test.'
---
# Tasks

Blueprint: [002](index.md)

## Goal & intent
`tasks.bouncer.graph.basis`를 그래프별 질의 레코드로 만든다. `validate`가 배열
형태를 검증하고, 레거시 문자열은 그대로 통과시키며, `scaffold`는 `basis: []`를
내고, `graphify-runner`가 그래프마다 `graph`·`status`·`query`·`result` 엔트리를
적는다. `status`는 `updated`·`reused`·`fail-skip`·`skip-disabled`·`missing`
다섯 값만 쓴다. 검증은 `npm test`.

## Interface
- 제공: `basis` = 비어 있지 않은 문자열(레거시) 또는 엔트리 객체의 비어 있지 않은 배열.
- 제공: 엔트리 필수 필드 `graph`(`source`|`context`), `status`(다섯 값 enum),
  `query`(실제 질의 문자열), `result`(질의 결과 요약). 모두 비어 있지 않은 문자열.
- 제공: `scaffold blueprint`의 `graph.basis` 기본값 `[]`.
- 거부: 빈 배열, 객체가 아닌 원소, enum 밖 `status`, 빈 문자열 필드 → 기존
  코드 S9(구조 검사) / G4(plan 게이트)로 보고. 새 코드 번호를 만들지 않는다.
- 거부: 질의를 못 돌렸다는 이유로 엔트리를 아예 빼는 기록 방식.

## Touch
- Modify `scripts/src/lib/validate.ts` — `basis` 검사기를 문자열/배열 양쪽을 받는
  헬퍼로 뽑고 S9·G4 두 호출 지점이 같은 헬퍼를 쓰게 한다. enum 상수도 여기 둔다.
- Modify `scripts/lib/validate.js` — build 산출.
- Modify `scripts/src/lib/scaffold.ts` — tasks frontmatter `graph.basis` 기본값을
  `''`에서 `[]`로 바꾼다.
- Modify `scripts/lib/scaffold.js` — build 산출.
- Modify `skills/graphify-runner/SKILL.md` — step 1·2·3·5를 그래프별 엔트리 기록
  절차로 고친다. `graph-sync`의 `built`/`failed`/`missing`을 `status`로 매핑하는
  표를 넣는다.
- Modify `skills/bouncer-plan/SKILL.md` — step 5·9의 `basis` 설명을 새 형태로
  맞춘다("빈 문자열" → "빈 리스트").
- Modify `test/validate-structural.test.js` — S9 문자열 통과·배열 통과·잘못된
  엔트리 거절 케이스.
- Modify `test/validate-gates.test.js` — G4가 배열 형태를 받고 빈 배열을 거절함.
- Modify `test/scaffold.test.js` — 새 tasks의 `graph.basis`가 `[]`임.
- Modify `test/skill-graphify-runner.test.js` — enum 다섯 값과 엔트리 필드 이름을
  문구로 고정.
- Modify `test/skill-bouncer-plan.test.js` — `basis` 관련 문구 갱신.
- Modify `docs/gates.md` — G4 행의 `graph.basis` 설명.
- Modify `docs/ARCHITECTURE.md` — §Graphify의 `basis` 문단(185~186행 부근).
- Modify `docs/troubleshooting.md` — `G4 tasks.graph.basis` 행에 배열 형태와 enum 안내.

## Do not touch
- `scripts/src/lib/schema.ts` — `graph`는 등록 대상이 아니다.
- `scripts/src/lib/graph-sync.ts`·`hooks/session-graph.js` — 동기화 동작 미변경.
- `.bouncer/context/epics/0*/blueprints/**/tasks.md` 중 이 blueprint 밖 문서 —
  기존 문자열 `basis`는 하위호환으로 남긴다.
- `test/native-profile-e2e.test.js`·`test/cli-current.test.js`·
  `test/cli-verify.test.js`·`test/migrate-ids.test.js` — 문자열 fixture가 수정
  없이 통과하는 것이 하위호환의 증거다.
- `skills/explain-diff/SKILL.md`·`skills/bouncer-finalize/SKILL.md` — 001·003.

## Constraints
- 새 게이트 코드·새 CLI를 만들지 않는다. 판정은 S9·G4가 계속 낸다.
- 검사 헬퍼는 하나만 두고 S9와 G4가 같은 것을 부른다 — 두 지점이 갈라지면
  구조 검사와 게이트가 서로 다른 답을 낸다.
- `scripts/lib` 손편집 금지. `npm run build`(또는 `pretest`)로 emit한다.
- `result`는 요약이다 — `graphify query` 원문 덤프를 frontmatter에 붙이지 않는다.
  히트 수와 상위 경로 몇 개까지.
- graphify 부재·비활성에서도 엔트리를 남겨 G4를 통과해야 한다. 기존 graceful
  skip 계약(“graph absence is a state, not an error”)을 깨지 않는다.
- 스킬 본문은 영어 유지.

## Checklist
- [ ] `test/validate-structural.test.js`에 실패 테스트를 먼저 넣는다.
  ```js
  // 레거시 문자열은 통과
  // basis: [] → S9
  // basis: [{ graph:'source', status:'bogus', query:'q', result:'r' }] → S9
  // basis: [{ graph:'source', status:'updated', query:'', result:'r' }] → S9
  // basis: [{ graph:'source', status:'updated', query:'q', result:'r' }] → 통과
  ```
- [ ] `test/validate-gates.test.js`에 G4 배열 통과 / 빈 배열 거절을 넣는다.
- [ ] `scripts/src/lib/validate.ts`에 `GRAPH_BASIS_STATUS` 상수와
  `isValidGraphBasis(basis)` 헬퍼를 만들고 S9·G4 두 곳에서 호출한다.
  ```ts
  const GRAPH_BASIS_STATUS = ['updated', 'reused', 'fail-skip', 'skip-disabled', 'missing'];
  ```
- [ ] `scripts/src/lib/scaffold.ts`의 `basis: ''`를 `basis: []`로 바꾸고
  `test/scaffold.test.js`를 맞춘다.
- [ ] `npm run build`로 `scripts/lib/validate.js`·`scaffold.js`를 재생성한다.
- [ ] `skills/graphify-runner/SKILL.md` step 5를 엔트리 기록 절차로 고치고,
  `graph-sync` 결과 → `status` 매핑 표를 넣는다(`built`→`updated`,
  최신이라 재빌드 없음→`reused`, `failed`→`fail-skip`,
  `skip-no-graphify`/`skip-graph-disabled`→`skip-disabled`,
  `missing`→`missing`).
- [ ] step 2 graceful skip 문단이 "엔트리를 남기고 건너뛴다"로 읽히게 고친다.
- [ ] `skills/bouncer-plan/SKILL.md`의 `basis` 문구를 맞춘다.
- [ ] `test/skill-graphify-runner.test.js`에 다섯 enum 값과 네 필드 이름 단언을
  각각 넣는다(교대 정규식 하나로 뭉치지 않는다).
- [ ] `docs/gates.md`·`docs/ARCHITECTURE.md`·`docs/troubleshooting.md` 문구 갱신.
- [ ] `npm test` 통과 — 기존 문자열 fixture 테스트가 수정 없이 통과하는지 확인.
