---
type: bouncer.tasks
title: 커밋 의도 작성 위치를 task 문서로 일원화
description: Tasks for 004
resource: .bouncer/context/epics/029-release-one-zero/blueprints/001-skill-structure/tasks/004/tasks.md
tags:
  - bouncer
  - tasks
timestamp: '2026-08-12T09:53:14.670+09:00'
bouncer:
  id: TASKS-004
  epic_id: '029'
  blueprint_id: '001'
  status: verified
  commit_intent:
    - 커밋 단위는 task인데 커밋 의도는 상위 문서에 적도록 서술돼 있어 위치가 어긋나 있음
    - 의도를 task 문서에만 쓰도록 좁히고 마감 커밋도 그 문서들에서 의도를 찾게 함
  affected_paths:
    - scripts/src/lib/finalize.ts
    - scripts/lib/finalize.js
    - skills/bouncer-plan/SKILL.md
    - skills/spec-authoring/SKILL.md
    - skills/bouncer-commit/SKILL.md
    - skills/bouncer-finalize/SKILL.md
    - docs/PILOT.md
    - docs/contributing.md
    - .gitmessage
    - test/finalize-pure.test.js
    - test/finalize.test.js
  graph:
    generated_at: '2026-08-12T09:53:14.670+09:00'
    command: mcp:graphify
    suggested_paths:
      - scripts/src/lib/finalize.ts
      - scripts/lib/finalize.js
      - skills/spec-authoring/SKILL.md
      - skills/bouncer-plan/SKILL.md
      - docs/PILOT.md
      - test/finalize-pure.test.js
    basis:
      - graph: source
        status: reused
        query: commit_intent normalizeIntent finalize remainder body
        result: >-
          graph-sync reported skip-fresh but the returned nodes name deleted
          paths; results discarded and paths seeded manually from a direct
          grep of commit_intent producers and consumers
      - graph: context
        status: updated
        query: 커밋 의도 작성 위치 task 문서
        result: >-
          rebuilt this run, but the query returned the same stale node set as
          the source graph; no usable context hits
---
# Tasks

Blueprint: [001](../../index.md)

## Goal & intent
커밋 단위는 task 문서 하나인데, 커밋 의도(`bouncer.commit_intent`)는 지침상
blueprint `index.md`에 쓰고 task에는 "선택적으로" 쓰는 것으로 서술돼 있다.
단위와 작성 위치가 어긋나 있다.

작성 위치를 **task 문서로 일원화**한다. `index.md`에는 쓰지 않는다.
그 결과 `finalize`의 Distill remainder 커밋이 읽을 출처가 사라지므로,
remainder도 task 문서들에서 의도를 찾도록 바꾼다.

현행 코드는 이미 task → blueprint 순으로 해석한다(`scripts/lib/finalize.js:94`).
바뀌는 것은 **remainder 경로**(같은 파일 118행)와 지침 서술이다.

## Interface
- 제공:
  - task 커밋 본문 — 현행 유지. 대상 task 문서의 `commit_intent` 2줄.
  - remainder 커밋 본문 — blueprint가 아니라 **모든 task 문서를 번호 순으로
    스캔**해 유효한 `commit_intent`(문자열 2개 리스트)를 찾는다. 그중
    **번호가 가장 큰 항목**을 쓴다. 근거는 `.gitmessage`가 배경·의도를
    **정확히 2줄**로 제한해 N개를 이어 붙일 수 없고, remainder는 blueprint의
    마지막 상태를 커밋하므로 마지막 task의 의도가 가장 가깝기 때문이다.
  - 유효한 항목이 하나도 없으면 배경·의도 줄 없이 제목과 수정 내용만 남긴다
    (현행 `|| []` 동작과 동일).
- 거부: `commit_intent`의 형태는 바꾸지 않는다 — 문자열 **정확히 2개**의 YAML
  리스트만 유효하고, 블록 스칼라나 1줄·3줄은 무효 처리한다
  (`normalizeIntent`의 현행 계약). blueprint `commit_type`은 그대로 둔다.

## Touch
- Modify `scripts/src/lib/finalize.ts` — remainder intent 해석을 blueprint 단일 출처에서 전체 task 스캔으로
- Modify `scripts/lib/finalize.js` — 위 변경의 CJS emit 반영
- Modify `skills/bouncer-plan/SKILL.md` — 4단계에서 `commit_intent`를 task 문서에 쓰도록, index에는 쓰지 않도록
- Modify `skills/spec-authoring/SKILL.md` — 필드 표와 서술에서 blueprint `commit_intent` 항목 제거·조정
- Modify `skills/bouncer-commit/SKILL.md` — "task then blueprint" 폴백 서술을 task 단일 출처로
- Modify `skills/bouncer-finalize/SKILL.md` — dry-run 전 blueprint `commit_intent` 요구 문구를 새 규칙으로
- Modify `docs/PILOT.md` — 커밋 본문 조립 설명 갱신
- Modify `docs/contributing.md` — task 단일 출처·remainder 최고 번호 규칙으로 갱신
- Modify `.gitmessage` — 본문 조립 출처 설명 갱신
- Modify `test/finalize-pure.test.js` — remainder intent 해석 테스트 추가·갱신
- Modify `test/finalize.test.js` — fixture intent를 task로 옮기고 expectation 갱신

## Do not touch
- `skills/implementation/SKILL.md`, `agents/` — 이 task는 커밋 의도 경로만 다룬다.
- `scripts/lib/commit.js` — task 커밋 경로는 이미 task 문서를 읽으므로 바뀌지 않는다.
  실제로 손봐야 한다고 판단되면 구현하지 말고 보고한다.
- `.bouncer/context/` — 이미 작성된 이 blueprint의 문서는 결과물이지 대상이 아니다.
- `CLAUDE.md` — TASKS-003이 맡는다.

## Constraints
- `scripts/src/lib/*.ts`를 고치면 `scripts/lib/*.js` CJS emit을 함께 커밋한다.
  소비자는 Node 전용이고 빌드 산출물이 저장소에 들어가 있다(Distill Invariants).
- `normalizeIntent`의 `Array.isArray` + 길이 2 계약을 유지한다. 이 계약이 느슨해지면
  블록 스칼라로 쓴 문서가 조용히 통과해 커밋 본문이 비는 회귀가 생긴다.
- 커밋 본문 줄 수 상한(배경·의도 2줄 + 수정 내용 1~2줄, 합계 4줄)을 넘기지 않는다.
- 커밋 의도 문구에는 파일·모듈·패키지 이름을 쓰지 않는다(`.gitmessage`).
- 지침에서 blueprint `commit_intent`를 지울 때 `commit_type`까지 지우지 않는다 —
  브랜치 접두사와 커밋 타입이 거기서 온다.

## Checklist
- [ ] `npm test`로 기준선이 green인지 확인한다.
- [ ] `test/finalize-pure.test.js`에 실패 테스트를 먼저 쓴다: blueprint에
      `commit_intent`가 없고 task 문서 여럿에 있을 때 remainder 본문이 가장 큰
      번호의 항목 2줄을 쓴다. 실패를 확인한 뒤 구현한다.
- [ ] `scripts/src/lib/finalize.ts`의 remainder 경로를 전체 task 스캔으로 바꾼다.
      task 커밋 경로(현행 task → blueprint)는 blueprint 폴백을 제거한다.
- [ ] `npm run build`로 `scripts/lib/finalize.js` emit을 갱신한다.
- [ ] 지침 5곳을 갱신한다 — plan 4단계, spec-authoring 필드 표, bouncer-commit
      폴백 서술, bouncer-finalize dry-run 전제, `docs/PILOT.md` 조립 설명.
- [ ] `.gitmessage`의 다음 문장을 새 규칙으로 고친다:
      ```
      /bouncer-finalize`는 blueprint `bouncer.commit_intent`(2줄) +
      tasks/verification `title`로 이 본문을 조립한다.
      ```
- [ ] blueprint `commit_intent`를 요구하거나 예시로 보여주는 곳이 남지 않았는지 확인한다:
      ```
      grep -rn "commit_intent" --include=*.md skills docs .gitmessage | grep -i blueprint
      ```
- [ ] `npm test` 통과를 확인한다.
