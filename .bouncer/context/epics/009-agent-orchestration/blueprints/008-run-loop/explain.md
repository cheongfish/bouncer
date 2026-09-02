---
type: bouncer.explain
title: 001 explain
description: Explain for 001
resource: .bouncer/context/epics/009-agent-orchestration/blueprints/008-run-loop/explain.md
tags:
  - bouncer
  - explain
timestamp: '2026-08-13T09:01:54.469+09:00'
bouncer:
  id: EXPLAIN-008
  epic_id: '009'
  blueprint_id: '008'
  status: published
  comprehension:
    - range_from: develop
      range_to: 38f5f997d739d8780c96b67d723f55374fd55ba5
      diff_sha: 0d71a4207d1f0789b917b6964b5cbf89e29018b115cc97a384bd859324f1a7ef
      quiz_score: '4/5'
      disposition: Q2만 오답 — autonomy 부재·허용 밖은 interactive가 아니라 auto로 진행함
      recorded_at: '2026-08-13T09:03:25+09:00'
---
# Explain

## Background

task가 늘수록 execute→commit 사이 확인이 선형으로 늘어났다. 게이트 판정은
코드가 이미 하는데, 다음 task로 넘기는 결정까지 매번 사람이 답하고 있었다.
이 변경은 `/bouncer-run`으로 그 구간만 반복하고, 멈추는 자리(verify 재실패,
리뷰 왕복 상한, 범위 위반)를 문서에 고정한다. plan·finalize 정본은 그대로다.
`config.autonomy`는 확인 횟수만 고른다. debugger 재디스패치 상한은 수동·자동
경로가 갈라지지 않도록 양쪽 모두 1회로 맞춘다.

## Intuition

수동 다섯 단계 위에서 execute→commit만 크루즈 컨트롤로 돌리고, 빨간불이
뜨면 그 task에 세워 둔다.

## Code

- `skills/bouncer-run/SKILL.md` — 루프 규칙·시작 ACQ·중단·`autonomy` 분기.
  execute/commit 본문을 복제하지 않고 두 스킬을 부른다.
- `scripts/src/lib/schema.ts` — `AUTONOMY_ENUM` / `DEFAULT_AUTONOMY`.
  `init.ts`·`config.example.json`이 새 저장소에 `autonomy: "auto"`를 심는다.
  기존 `config.json`은 건드리지 않는다.
- `skills/bouncer-execute/SKILL.md`, `skills/debugging/SKILL.md`,
  `agents/bouncer-debugger.md` — 같은 verify 실패 재디스패치 상한 **1회**.
- `CLAUDE.md`, `docs/workflow.md` — `/bouncer-run`을 다섯 단계의 **대체 경로**로
  서술. finalize는 run이 부르지 않는다.

## Quiz

1. `/bouncer-run`이 소진 후 하는 일은?
   - A) `/bouncer-finalize`까지 자동 진입
   - B) 멈추고 `/bouncer-finalize`를 안내만 함
   - C) 다음 ready blueprint로 포인터를 옮김

2. `config.autonomy`가 없거나 허용 목록 밖이면?
   - A) 주행을 막고 `bouncer init`으로 보냄
   - B) `interactive`로 진행
   - C) 알린 뒤 `auto`로 진행

3. 같은 verify 실패에 debugger를 다시 보내는 상한은?
   - A) 1회 (수동·자동 동일)
   - B) 자동 주행만 1회, 수동은 3회
   - C) 3회

4. `auto` 모드에서 `/bouncer-commit`의 commit·next-task ACQ는?
   - A) 매 task마다 그대로 묻음
   - B) 시작 ACQ가 대신하므로 건너뜀
   - C) commit만 묻고 next-task는 건너뜀

5. verify 재실패로 멈추면?
   - A) 포인터를 비우고 worktree를 지움
   - B) 포인터·worktree를 그 task에 남기고, 수동 execute 후 run을 다시 검
   - C) `/bouncer-run`이 같은 task를 자동 재시도함

## 이해 상태

- 점수: 4/5
- 정답: 1B · 2C · 3A · 4B · 5B
- 응답: 1B · 2A · 3A · 4B · 5B
- 채점: 1✓ 2✗ 3✓ 4✓ 5✓
- disposition: Q2만 오답 — autonomy 부재·허용 밖은 interactive가 아니라 auto로 진행함
- range: develop..38f5f997d739d8780c96b67d723f55374fd55ba5
- diff_sha: 0d71a4207d1f0789b917b6964b5cbf89e29018b115cc97a384bd859324f1a7ef
