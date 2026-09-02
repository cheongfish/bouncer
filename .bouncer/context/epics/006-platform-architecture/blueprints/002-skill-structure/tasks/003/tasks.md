---
type: bouncer.tasks
title: 코드 주석 규칙을 마스터 규칙으로 승격
description: Tasks for 003
resource: .bouncer/context/epics/006-platform-architecture/blueprints/002-skill-structure/tasks/003/tasks.md
tags:
  - bouncer
  - tasks
timestamp: '2026-08-12T09:53:14.670+09:00'
bouncer:
  id: 'TASKS-003'
  epic_id: '006'
  blueprint_id: '002'
  status: verified
  commit_intent:
    - 주석 규칙이 구현 경로 안에만 있어 그 경로를 타지 않는 에이전트는 규칙을 보지 못함
    - 규칙을 마스터 규칙으로 올리고 기준이 되는 대비 예시를 함께 두어 해석을 좁힘
  affected_paths:
    - CLAUDE.md
    - skills/implementation/SKILL.md
    - agents/bouncer-implementer.md
    - test/master-rules.test.js
    - test/skill-implementation.test.js
    - test/agents.test.js
  graph:
    generated_at: '2026-08-12T09:53:14.670+09:00'
    command: mcp:graphify
    suggested_paths:
      - CLAUDE.md
      - skills/implementation/SKILL.md
      - agents/bouncer-implementer.md
      - test/master-rules.test.js
      - test/skill-implementation.test.js
      - test/agents.test.js
    basis:
      - graph: source
        status: reused
        query: implementation comment rule master rules hard rule
        result: >-
          graph-sync reported skip-fresh but the returned nodes name deleted
          paths; results discarded and paths seeded manually from the two
          current comment-rule sites (skills/implementation/SKILL.md:32-40,
          agents/bouncer-implementer.md:53)
      - graph: context
        status: updated
        query: 코드 주석 규칙 하드룰 승격
        result: >-
          rebuilt this run, but the query returned the same stale node set as
          the source graph; no usable context hits

---
# Tasks

Blueprint: [002](../../index.md)

## Goal & intent
코드 주석 규칙은 지금 `skills/implementation/SKILL.md:32-40`과
`agents/bouncer-implementer.md:53`에만 있다. 두 곳 모두 구현 경로 안이라,
그 경로를 타지 않는 에이전트는 규칙을 보지 못한다. 자동 루프가 task마다 새
implementer를 여는 구조로 가면 해석이 더 갈린다.

규칙을 `CLAUDE.md` 하드룰로 올려 모든 스킬·서브에이전트에 걸리게 하고,
`implementation` 스킬에는 좋은 주석과 나쁜 주석을 대비한 예시를 넣는다.
지금 규칙은 서술만 있고 예시가 없어 "상세히"의 기준이 사람마다 다르다.

## Interface
- 제공: `CLAUDE.md` 「Hard rules」에 코드 주석 규칙 한 항목(9번).
  `skills/implementation/SKILL.md`에 좋은/나쁜 주석 대비 예시 2~3쌍.
- 거부: 기존 하드룰 1~8의 번호와 내용은 바꾸지 않는다. 주석 규칙의 **내용**
  자체(왜를 적는다 / 자명한 한 줄은 생략 / 한국어)는 현행을 그대로 옮기며,
  새 요구사항을 추가하지 않는다.

## Touch
- Modify `CLAUDE.md` — 하드룰 9(코드 주석) 추가
- Modify `skills/implementation/SKILL.md` — 4번 항목을 하드룰 참조로 정리하고 대비 예시 추가
- Modify `agents/bouncer-implementer.md` — 하드룰과 같은 내용을 가리키도록 정리
- Modify `test/master-rules.test.js` — 하드룰 9 존재 단정 추가
- Modify `test/skill-implementation.test.js` — 예시 존재 단정 추가
- Modify `test/agents.test.js` — implementer 문서의 주석 규칙 단정 갱신

## Do not touch
- `skills/bouncer-*/SKILL.md` — TASKS-001이 맡는다. 하드룰 추가는 워크플로 스킬
  본문을 고칠 필요가 없다.
- `skills/minimality/SKILL.md` — 「설명 주석은 minimize 대상이 아니다」 문구는
  이미 정합하므로 손대지 않는다. TASKS-002가 description만 건드린다.
- `scripts/`, `docs/` — 규칙 위치는 마스터 규칙과 구현 스킬이다.

## Constraints
- 하드룰은 **경로와 의무만** 적고 예시는 넣지 않는다. `CLAUDE.md` 7번이
  Distill을 다루는 방식(경로와 읽기 의무만, 본문 내용은 금지)과 같은 형태를
  따른다. 예시는 `implementation` 스킬에 둔다.
- 예시는 이 저장소의 실제 코드에서 가져온다. 가공한 가짜 예시를 만들지 않는다.
  `scripts/lib/validate.js`의 게이트 주석이 좋은 예시의 후보다.
- 하드룰 번호는 9로 이어 붙인다. 기존 번호를 재배치하면
  `test/master-rules.test.js`와 스킬 본문의 「하드룰 N」 언급이 어긋난다.
- 저장소 전체에서 「하드룰 N」 형태로 번호를 인용한 곳이 있으면 그 번호가
  여전히 맞는지 확인한다.

## Checklist
- [ ] `npm test`로 기준선이 green인지 확인한다.
- [ ] `CLAUDE.md` 「Hard rules」에 9번을 추가한다. 내용은 경로와 의무만 —
      "구현 코드의 비자명한 의도는 한국어 주석으로 남긴다. 상세 지침과 예시는
      `skills/implementation/SKILL.md`" 수준.
- [ ] `skills/implementation/SKILL.md` 4번 항목을 하드룰 참조로 줄이고,
      좋은/나쁜 주석 대비 예시 2~3쌍을 추가한다. 각 쌍은 같은 코드에 대해
      「무엇을 반복한 주석」과 「왜를 적은 주석」을 나란히 보인다.
- [ ] `agents/bouncer-implementer.md:53`의 주석 항목이 하드룰과 같은 내용을
      가리키게 정리한다. 규칙을 두 벌로 서술하지 않는다.
- [ ] `test/master-rules.test.js`에 하드룰 9 단정을 추가한다.
- [ ] `test/skill-implementation.test.js`에 예시 블록 존재 단정을 추가한다.
- [ ] `test/agents.test.js`의 implementer 단정이 새 문구와 맞는지 확인하고 갱신한다.
- [ ] 하드룰 번호 인용을 점검한다:
      ```
      grep -rn "하드룰\|hard rule" --include=*.md skills agents docs CLAUDE.md | grep -v node_modules
      ```
- [ ] `npm test` 통과를 확인한다.
