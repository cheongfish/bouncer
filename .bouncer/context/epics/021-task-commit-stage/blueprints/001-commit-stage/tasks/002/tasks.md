---
type: bouncer.tasks
title: 이해 기록을 task 엔트리 배열로 바꾸고 G15를 task 커밋 범위로 판정함
description: Tasks for 002
resource: .bouncer/context/epics/021-task-commit-stage/blueprints/001-commit-stage/tasks/002/tasks.md
tags:
  - bouncer
  - tasks
timestamp: '2026-08-07T14:13:08.438+09:00'
bouncer:
  id: TASKS-002
  epic_id: '021'
  blueprint_id: '001'
  status: ready
  commit_intent:
    - explain의 이해 기록이 blueprint에 한 벌뿐이라 두 번째 task를 마감하면 첫 기록이 덮임
    - 기록을 task 엔트리 배열로 두고 해시 범위를 그 task 커밋 구간으로 좁힘
  affected_paths:
    - scripts/src/lib/comprehension.ts
    - scripts/src/lib/scaffold.ts
    - scripts/src/lib/validate.ts
    - scripts/lib/comprehension.js
    - scripts/lib/scaffold.js
    - scripts/lib/validate.js
    - test/comprehension.test.js
    - test/scaffold.test.js
    - test/validate-gates.test.js
  graph:
    generated_at: '2026-08-07T14:35:00+09:00'
    command: graphify query (source + context)
    suggested_paths:
      - scripts/src/lib
      - scripts/lib
      - test
      - skills
      - docs
    basis:
      - graph: source
        status: updated
        query: buildCommitMessage finalize.ts validate.ts comprehension.ts scaffold explain cli.ts
        result: 12 hits — 전부 폐기된 `.superpowers/` · `commands/sdd-*.md` 노드라 현재 트리와 대응되지 않음. 인덱스가 낡아 경로를 수동 확정
      - graph: context
        status: updated
        query: task 단위 커밋 finalize explain 이해 기록 게이트
        result: source 쿼리와 동일한 폐기 노드 12개. 사용 불가로 판단하고 수동 확정
---
# Tasks

Blueprint: [001](../../index.md)

## Goal & intent
`explain.md`의 `bouncer.comprehension`이 task별 엔트리 배열이 되고, G15가
포인터가 지목한 task의 엔트리 하나만 판정한다. 해시 범위는 `base..HEAD`가
아니라 그 엔트리의 `range_from..HEAD`다. 이전 task의 기록은 그대로 남고, task를
추가로 마감해도 앞 엔트리 때문에 게이트가 막히지 않는다.

게이트 이름은 아직 `finalize`다. 003이 `commit`으로 옮긴다.

## Interface
- 제공
  - 엔트리 형태:
    ```yaml
    comprehension:
      - task: '001'          # \d{3}
        range_from: <sha 또는 base ref>
        range_to: <기록 시점 HEAD sha>
        diff_sha: <computeDiffSha(range_from) 결과>
        quiz_score: 'N/M'
        disposition: <비어 있지 않은 문자열>
        recorded_at: <ISO-8601>
    ```
  - `scripts/src/lib/comprehension.ts`가
    `findComprehensionEntry(comprehension, taskNumber)`를 export한다. 반환은
    `{ ok: true, entry }` 또는 `{ ok: false, reason: 'not-a-list' | 'missing'
    | 'duplicate' | 'incomplete' }`. 절대 throw하지 않는다.
  - `scaffold explain`이 `comprehension: []`을 쓴다.
  - G15가 대상 task 번호의 엔트리를 찾아, `computeDiffSha`에 그 엔트리의
    `range_from`을 넘겨 `diff_sha`와 비교한다.
- 거부
  - `comprehension`이 배열이 아니면(구 객체 형식 포함) G15가
    `explain comprehension must be a list of task entries`로 실패한다. 자동
    변환하지 않는다.
  - 같은 `task` 값 엔트리가 둘 이상이면 실패한다. 마지막 엔트리를 고르지
    않는다.
  - 빈 배열이거나 대상 task 엔트리가 없으면 지금과 같은
    `explain comprehension record missing`이다.
  - 엔트리에 `range_from`·`diff_sha`·`disposition` 중 빈 값이 있으면 기록
    없음으로 본다.

## Touch
- Create 없음 — 기존 모듈만 확장
- Modify `scripts/src/lib/comprehension.ts` — 엔트리 조회·형식 판정 헬퍼 추가
- Modify `scripts/src/lib/scaffold.ts` — `scaffoldExplain`의 기본값을 빈 배열로
- Modify `scripts/src/lib/validate.ts` — G15가 대상 task 엔트리와 `range_from` 사용
- Modify `scripts/lib/comprehension.js` `scripts/lib/scaffold.js` `scripts/lib/validate.js` — CJS 산출물
- Modify `test/comprehension.test.js` — 엔트리 조회 헬퍼의 반환 형태
- Modify `test/scaffold.test.js` — explain 기본값
- Modify `test/validate-gates.test.js` — G15의 엔트리 판정과 거절 사유

## Do not touch
- `scripts/src/lib/finalize.ts` — 001에서 확정
- `scripts/src/lib/cli.ts` — 003
- `scripts/src/lib/current.ts` — 포인터 해석은 019 그대로
- `skills` `docs` — 005
- `.bouncer/context/epics` — 다른 blueprint의 완료된 explain은 건드리지 않는다

## Constraints
- `computeDiffSha`의 시그니처와 제외 경로(`.bouncer/context/`)를 바꾸지 않는다.
  `base` 인자에 엔트리의 `range_from`을 넘기는 방식으로만 범위를 좁힌다.
- 대상 task 선택은 `resolveTaskUnit`을 재사용한다. 두 번째 해석기를 만들지
  않는다.
- 게이트 코드 번호 G15와 기존 실패 메시지 문자열
  (`explain comprehension record missing`,
  `explain diff_sha could not be computed (<reason>)`)은 유지한다. 새 사유는
  형식 거절 한 줄만 추가한다.
- 구 형식 마이그레이션 도구를 만들지 않는다. 이미 마감된 blueprint는 다시
  게이트를 통과할 일이 없다.
- `diff_sha` 비교 대상은 여전히 실행 시점 `HEAD`다. 엔트리의 `range_to`를
  해시 계산에 쓰지 않는다 — 기록 후 커밋이 더 쌓이면 어긋나야 한다.

## Checklist
- [ ] `test/comprehension.test.js`에 `findComprehensionEntry`의 실패 테스트를
      먼저 추가한다:
      ```js
      assert.deepStrictEqual(findComprehensionEntry({ diff_sha: 'x' }, '001'), { ok: false, reason: 'not-a-list' });
      assert.deepStrictEqual(findComprehensionEntry([], '001'), { ok: false, reason: 'missing' });
      ```
      중복 `task`는 `duplicate`, 빈 `range_from`·`diff_sha`·`disposition`은
      `incomplete`임을 확인한다.
- [ ] `test/scaffold.test.js`에서 `scaffold explain` 결과 frontmatter가
      `comprehension: []`인지 확인하는 테스트를 추가한다.
- [ ] `test/validate-gates.test.js`에 fixture를 추가한다. `tasks/001`과
      `tasks/002`가 있고 explain에 `001` 엔트리만 있을 때, 포인터가
      `tasks/002/tasks.md`면 G15가 record missing으로 실패하고, 포인터가
      `tasks/001/tasks.md`면 통과한다. `computeDiffSha`는 `deps`로 주입해
      `range_from`이 그대로 `base` 인자로 넘어가는지 확인한다.
- [ ] 구 객체 형식 fixture로 형식 거절 메시지가 나오는지 확인한다.
- [ ] 위 테스트가 실패하는 것을 확인한 뒤 `comprehension.ts` →
      `scaffold.ts` → `validate.ts` 순으로 구현한다.
- [ ] `npm run build` 후 `npm test`가 통과한다.
