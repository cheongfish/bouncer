---
type: bouncer.tasks
title: integration 직접 수정 거절 안내 보강
description: Clarify integration-source-mutated cause and next for governance changes
resource: .bouncer/context/epics/drive-execution/blueprints/repair-resume-integrity/tasks/004/tasks.md
tags:
  - bouncer
  - tasks
  - coordinator
  - hints
  - integration
timestamp: '2026-10-20T21:02:18.336+09:00'
bouncer:
  id: TASKS-004
  epic_id: drive-execution
  blueprint_id: repair-resume-integrity
  status: ready
  execution_kind: commit
  depends_on:
    - TASKS-001
  parallel_safe: false
  dependency_gate: integrated
  affected_paths:
    - scripts/src/lib/coordinator-commands.ts
    - agents/bouncer-coordinator.md
    - .codex/agents/bouncer-coordinator.toml
    - test/coordinator.test.js
  commit_intent:
    - epic 이관 같은 governance 변경을 integration checkout에 직접 넣으면 fan-in이 거절하는데 안내가 대안을 알려 주지 않던 문제를 막음.
  commit_summary:
    - 거절 힌트와 coordinator 문서에 main 선커밋과 worker task·repair 경로를 적음.
  review_risk: []
  verify: node --test test/coordinator.test.js test/agents.test.js
---
# Tasks

Blueprint: [repair-resume-integrity](../../index.md)

## Goal & intent
guard는 그대로 두고 `integration-source-mutated`의 `cause`/`next`와 coordinator 문서가 "governance 변경은 drive 전에 main에 커밋하고, drive 중에는 worker task나 `bouncer coordinate repair`로 옮기며, integration checkout을 직접 고치지 않는다"를 말하게 한다. 수용 기준은 blueprint Contract 5이고 검증 명령은 `node --test test/coordinator.test.js test/agents.test.js`다.

## Current behavior
- guard: `disallowedDirtyPaths`(`scripts/src/lib/coordinator-commands.ts:3378`)가 seed manifest와 integrated/dynamic task 증적 밖 dirty 경로를 찾으면 integrate가 `integration-source-mutated`로 거절한다(`:3638-3639`).
- 힌트: `COORDINATE_FAILURE_HINTS['integration-source-mutated']`(`:5398-5403`) `next`는 "Move the change into a worker task or `bouncer coordinate repair`, revert the direct edits ..."이고 governance·main 선커밋을 말하지 않는다.
- 문서: `agents/bouncer-coordinator.md:144-148`은 "revert them and move the change to a worker task"만 적는다. 이 문서는 `.codex/agents/bouncer-coordinator.toml`과 바이트 일치해야 한다(`test/agents.test.js:44-58`).
- 테스트: `test/coordinator.test.js:222-229`(모든 reason에 힌트), `:214-215`(`cause !== reason`). 힌트 문구 단언은 없다.

## Target behavior
- 성공: 힌트 `cause`는 integration checkout의 미커밋 변경이 seed·증적 밖이라는 사실과 root/coordinator 직접 수정이 원인임을 말한다. `next`는 (1) drive 전 governance 변경(epic 이관, `.bouncer/epics.json`)은 main에 커밋하고 drive를 다시 준비, (2) drive 중 소스 변경은 worker task 또는 `bouncer coordinate repair`, (3) 직접 수정은 되돌린 뒤 integrate 재시도를 담는다.
- 보존: guard 동작·허용 경로·거절 사유 문자열은 그대로다. coordinator 문서 제목 골격(`scripts/check-doc-shape.js:784-789`)과 Worker dispatch 20줄 상한은 그대로다.

## Interface
- 제공: `withCoordinateFailureHints({ok:false, reason:'integration-source-mutated'})`의 `next`에 `main`과 ```bouncer coordinate repair```가 들어간다.
- 거부: guard 완화 없음.

## Touch
| 경로 | 심볼 | 변경 | 현재 책임 | 계획한 변경 | 근거 |
| --- | --- | --- | --- | --- | --- |
| `scripts/src/lib/coordinator-commands.ts` | `COORDINATE_FAILURE_HINTS['integration-source-mutated']` | Modify | worker task·repair만 안내 | main 선커밋 안내 추가 | 사용자 노출 문구(`:5398-5403`) |
| `agents/bouncer-coordinator.md` | Procedure의 integrate 거절 문단 | Modify | revert 후 worker task로 옮기라고만 함 | governance 변경 main 선커밋 문장 추가 | 역할 문서(`:144-148`) |
| `.codex/agents/bouncer-coordinator.toml` | 생성 산출물 | Modify | md와 바이트 일치 | md 변경 후 `mdToCodexToml`로 재생성 | `test/agents.test.js:44-58` |
| `test/coordinator.test.js` | 힌트 단언 | Modify | 힌트 존재만 단언 | `next`에 `main`과 `bouncer coordinate repair` 포함 단언 추가 | 검증 지점(`:214-229`) |

## Do not touch
- `scripts/src/lib/coordinate-next.ts` — TASKS-002 범위
- `scripts/src/lib/scope.ts` — TASKS-003 범위
- `test/cli-coordinate.test.js` — TASKS-001 범위

## Constraints
- `disallowedDirtyPaths`와 integrate guard 로직은 바꾸지 않는다.
- `.codex/agents/bouncer-coordinator.toml`은 손으로 쓰지 않고 생성 함수로 만든다.

## Checklist
- [ ] `test/coordinator.test.js`에 아래 단언을 추가한다. 기대 red: 현재 `next`에 `main`이 없어 `/\bmain\b/` 단언이 실패한다.
  ```js
  const hinted = withCoordinateFailureHints({ ok: false, reason: 'integration-source-mutated' });
  assert.match(hinted.next, /\bmain\b/);
  assert.ok(hinted.next.includes('`bouncer coordinate repair`'));
  ```
- [ ] `npm run build` 후 `node --test test/coordinator.test.js`로 red를 확인한다.
- [ ] 힌트 `cause`/`next`와 `agents/bouncer-coordinator.md` 문단을 고친다.
- [ ] `node -e "const fs=require('fs');const {mdToCodexToml}=require('./scripts/lib/codex-agents');fs.writeFileSync('.codex/agents/bouncer-coordinator.toml', mdToCodexToml(fs.readFileSync('agents/bouncer-coordinator.md','utf8')))"`로 TOML을 재생성한다.
- [ ] `npm run lint:docs`가 통과한다.
- [ ] `node --test test/coordinator.test.js test/agents.test.js`가 통과한다.
