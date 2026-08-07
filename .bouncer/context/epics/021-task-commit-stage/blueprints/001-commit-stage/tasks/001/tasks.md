---
type: bouncer.tasks
title: 커밋 subject와 배경·의도를 대상 task 문서에서 가져옴
description: Tasks for 001
resource: .bouncer/context/epics/021-task-commit-stage/blueprints/001-commit-stage/tasks/001/tasks.md
tags:
  - bouncer
  - tasks
timestamp: '2026-08-07T14:13:08.438+09:00'
bouncer:
  id: TASKS-001
  epic_id: '021'
  blueprint_id: '001'
  status: verified
  commit_intent:
    - task마다 커밋해도 subject가 blueprint title 고정이라 같은 문장이 반복됨
    - 커밋 제목과 배경·의도를 대상 task 문서에서 읽어 커밋 로그가 task를 구분하게 함
  affected_paths:
    - scripts/src/lib/finalize.ts
    - scripts/lib/finalize.js
    - test/finalize-pure.test.js
    - test/finalize.test.js
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
커밋 메시지가 대상 task를 가리킨다. subject는 `<commit_type>: <대상 task의
title>`이고, 배경·의도 2줄은 대상 task `tasks.md`의 `bouncer.commit_intent`,
없으면 blueprint의 같은 필드에서 온다. `commit_type`은 지금처럼 blueprint에서
공유한다.

이 시점에는 아직 `bouncer commit`이 없으므로 `finalize`가 이 메시지를 만든다.
003이 커밋 경로를 옮길 때 같은 함수를 그대로 쓴다.

## Interface
- 제공
  - `buildCommitMessage(docs, taskUnit)`의 subject가
    `<commit_type>: <taskUnit.tasks.data.title>`이다. 대상 묶음이 없거나 그
    `title`이 비면 blueprint `title`로 떨어진다.
  - 배경·의도 bullet의 출처가 `taskUnit.tasks.data.bouncer.commit_intent` →
    blueprint `bouncer.commit_intent` 순이다. 각 출처는 비어 있지 않은 문자열
    **정확히 2개**일 때만 유효하다.
  - 수정 내용 bullet은 대상 묶음의 `verification.md` `title` 하나다. tasks
    `title`은 이미 subject에 있으므로 bullet에서 뺀다.
- 거부
  - `commit_intent`가 1줄이거나 3줄 이상이면 그 출처를 쓰지 않는다. 앞 2줄을
    잘라 쓰는 동작을 남기지 않는다.
  - 양쪽 출처가 모두 무효면 배경·의도 bullet 없이 수정 내용만 남는다.
  - Epic/Blueprint id와 파일 경로는 메시지에 넣지 않는다.

## Touch
- Modify `scripts/src/lib/finalize.ts` — `buildCommitMessage`의 subject·intent 출처
- Modify `scripts/lib/finalize.js` — `npm run build`가 다시 만드는 CJS 산출물
- Modify `test/finalize-pure.test.js` — subject와 intent 폴백 단계별 기대값
- Modify `test/finalize.test.js` — 커밋 경로에서 만들어지는 메시지 형태

## Do not touch
- `scripts/src/lib/comprehension.ts` `scripts/src/lib/scaffold.ts` — 002
- `scripts/src/lib/validate.ts` — 002와 004
- `scripts/src/lib/cli.ts` — 003
- `skills` `docs` `CLAUDE.md` `AGENTS.md` — 005
- `.bouncer/context/epics` — 문서 상태 전이는 워크플로가 한다

## Constraints
- `slice(0, 2)`로 앞 2줄을 잘라 쓰는 현행 동작을 유지하지 않는다. 길이가 정확히
  2가 아니면 그 출처는 무효다.
- 대상 묶음 선택은 004/020이 정한 `resolveTaskUnit` 결과를 그대로 받는다. 이
  함수 안에서 포인터를 다시 읽지 않는다.
- 레거시 호환 필드 `docs.tasks` / `docs.verification` 폴백 경로를 새로 만들지
  않는다. 대상 묶음이 없을 때의 동작만 지금처럼 남긴다.
- 커밋 메시지 구조(subject 한 줄, 빈 줄, `- ` bullet)는 `.gitmessage` 규약대로
  유지한다.

## Checklist
- [ ] `test/finalize-pure.test.js`에 실패 테스트를 먼저 추가한다. 대상 묶음
      `tasks.md`의 `title`이 `게이트를 task 단위로 좁힘`이고 blueprint `title`이
      `blueprint 제목`일 때:
      ```js
      assert.match(buildCommitMessage(docs, taskUnit).split('\n')[0], /^feat: 게이트를 task 단위로 좁힘$/);
      ```
- [ ] task `commit_intent` 2줄이 있으면 그 2줄이, 없으면 blueprint 2줄이 배경·의도
      bullet이 되는 테스트를 추가한다. task가 1줄일 때 blueprint로 떨어지는지도
      확인한다.
- [ ] 양쪽 모두 무효일 때 bullet이 수정 내용 한 줄뿐인지 확인하는 테스트를
      추가한다.
- [ ] 대상 묶음이 `undefined`일 때 subject가 blueprint `title`로 떨어지는지
      확인한다.
- [ ] 위 테스트가 실패하는 것을 확인한 뒤 `buildCommitMessage`를 구현한다.
- [ ] `npm run build`로 `scripts/lib/finalize.js`를 다시 만든다.
- [ ] `npm test`가 통과한다.
