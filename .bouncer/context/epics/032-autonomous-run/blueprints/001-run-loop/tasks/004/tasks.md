---
type: bouncer.tasks
title: debugger 재디스패치 상한을 1회로 통일
description: Tasks for 004
resource: .bouncer/context/epics/032-autonomous-run/blueprints/001-run-loop/tasks/004/tasks.md
tags:
  - bouncer
  - tasks
timestamp: '2026-08-12T18:40:00+09:00'
bouncer:
  id: TASKS-004
  epic_id: '032'
  blueprint_id: '001'
  status: ready
  commit_intent:
    - 같은 verify 실패를 세 번까지 다시 파게 두면 근본 원인이 아니라 시도 횟수로 문제를 미는 셈이 됨
    - 수동 경로와 자동 주행이 같은 수를 갖도록 재디스패치 상한을 한 번으로 낮춤
  affected_paths:
    - skills/bouncer-execute/SKILL.md
    - skills/debugging/SKILL.md
    - agents/bouncer-debugger.md
    - test/skill-debugging.test.js
  graph:
    generated_at: '2026-08-12T18:40:00+09:00'
    command: git grep -n "at most|redispatch|3회" -- skills docs agents test
    suggested_paths:
      - skills
      - agents
      - test
    basis:
      - graph: source
        status: reused
        query: debugger redispatch limit verify failure escalate plan
        result: source_dirs가 scripts/hooks/test라 skills/·agents/ 히트가 없음. 상한 문구 세 자리는 git grep으로 확정 — bouncer-execute/SKILL.md L170, debugging/SKILL.md L55, agents/bouncer-debugger.md L50
      - graph: context
        status: reused
        query: debugger redispatch limit verify failure escalate plan
        result: 컨텍스트 그래프는 epic Success criteria 섹션만 담아 상한 문구를 갖지 않음 — 히트 없음
---
# Tasks

Blueprint: [001](../../index.md)

## Goal & intent
같은 verify 실패에 대한 `bouncer-debugger` 재디스패치 상한이 세 곳 모두 **1회**가
된다. 수동 경로와 자동 주행이 같은 수를 쓰므로, `/bouncer-run`은 execute 위에
따로 상한을 씌우지 않고 그 수를 그대로 물려받는다.

## Interface
- 제공:
  - `skills/bouncer-execute/SKILL.md` 4단계의 상한 문장이 1회가 된다. 한 번
    고쳐 재검증했는데 같은 verify가 또 실패하면 아키텍처 / `/bouncer-plan`으로
    에스컬레이션한다.
  - `skills/debugging/SKILL.md`의 「redispatch / retry at most **3** times」가
    같은 규칙으로 바뀐다.
  - `agents/bouncer-debugger.md`의 `## Redispatch limit` 절이 같은 수를 말한다.
  - `test/skill-debugging.test.js`가 그 수를 단언한다. 세 파일이 서로 다른
    수를 말하면 실패한다.
- 거부:
  - 상한을 문서마다 다르게 두지 않는다. 「보통 1회, 사정에 따라 더」 같은
    여지를 남기는 문구를 쓰지 않는다.
  - 에스컬레이션 대상을 바꾸지 않는다. 상한에 닿으면 지금처럼 아키텍처 /
    `/bouncer-plan`이다.
  - debugger의 읽기 전용 계약을 건드리지 않는다. 상한 숫자만 바뀐다.

## Touch
- Modify `skills/bouncer-execute/SKILL.md` — 4단계 verify 실패 문단의 상한을 1회로
- Modify `skills/debugging/SKILL.md` — Guardrails의 상한 문장을 같은 수로
- Modify `agents/bouncer-debugger.md` — `## Redispatch limit` 절을 같은 수로
- Create/Modify `test/skill-debugging.test.js` — 세 문서의 상한 일치 단언 추가

## Do not touch
- `skills/bouncer-run/SKILL.md` — TASKS-002가 이미 1회로 적었다. 이 task는 그 수를 읽어 단언에 넣을 뿐 본문을 고치지 않는다
- `skills/bouncer-commit/SKILL.md` · `skills/bouncer-finalize/SKILL.md` — 디버거 경로와 무관하다
- `scripts/` 전체 — 상한은 문서 계약이며 코드가 세지 않는다
- `.bouncer/Distill.md` — 상한을 3으로 적은 Decision 줄은 `/bouncer-finalize`의 승격 경로가 고친다. task 커밋이 손대는 자리가 아니다

## Constraints
- 세 문서의 문구를 같은 숫자로 맞추되 문장까지 복사하지 않는다. 각 문서는
  자기 독자(컨트롤러 / 스킬 사용자 / 에이전트)에게 맞는 문장을 유지한다.
- 숫자를 `**1**`처럼 강조 표기로 적어 단언이 문서 형태에 기대지 않게 한다.
- 이 변경의 이유(무인 주행에서 같은 실패를 반복하는 비용)를 `explain.md`에
  남길 수 있도록, 커밋 본문 의도를 `commit_intent` 두 줄로 이미 적어 둔다.

## Checklist
- [ ] `test/skill-debugging.test.js`에 실패하는 단언을 먼저 넣고 실패를 확인한다.
      ```js
      const CAP = /at most \*\*1\*\*|최대 \*\*1\*\*회|\*\*1\*\*회/;
      for (const rel of [
        'skills/bouncer-execute/SKILL.md',
        'skills/debugging/SKILL.md',
        'agents/bouncer-debugger.md',
        'skills/bouncer-run/SKILL.md',
      ]) {
        const md = fs.readFileSync(path.join(root, rel), 'utf8');
        assert.match(md, CAP, rel);
        assert.doesNotMatch(md, /at most \*\*3\*\*/, rel);
      }
      ```
      (실제 문구에 맞춰 정규식을 조정하되, 세 파일을 모두 도는 형태를 유지한다.)
- [ ] `skills/bouncer-execute/SKILL.md` 4단계 상한 문장을 고친다.
- [ ] `skills/debugging/SKILL.md` Guardrails 상한 문장을 고친다.
- [ ] `agents/bouncer-debugger.md` `## Redispatch limit` 절을 고친다.
- [ ] `npm test`가 통과한다.
