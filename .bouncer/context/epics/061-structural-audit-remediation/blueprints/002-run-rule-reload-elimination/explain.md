---
type: bouncer.explain
title: 실행 주기 규칙 적재 설명
description: Explains session-scoped immutable rule loading for bouncer-run drives.
resource: .bouncer/context/epics/061-structural-audit-remediation/blueprints/002-run-rule-reload-elimination/explain.md
tags:
  - bouncer
  - explain
  - run-loop
  - rule-loading
  - token-efficiency
timestamp: '2026-09-03T14:20:07.674+09:00'
bouncer:
  id: EXPLAIN-002
  epic_id: '061'
  blueprint_id: '002'
  status: published
  comprehension:
    - range_from: develop
      range_to: 9a9696cc2c9786643ed514572405b79f6c02603b
      diff_sha: 1e3e5ebbbf5731ea350e044dd7054770695b1c5edafb6814f858bc24b69c7d96
      quiz_score: 3/3
      disposition: 세션·drive 경계와 Distill/gate 유지 범위를 구분함
      recorded_at: '2026-09-03T14:21:35+09:00'
  task_commits: []
---
# Explain

## Background

`/bouncer-run`은 같은 drive에서 task를 반복할 때마다 master·product rules를 다시 읽어 토큰을 낭비했다. 세션·drive 경계를 문서 계약으로 고정해, 불변 규칙은 진입 시 한 번만 적재하고 이후 반복에서는 다시 읽지 않게 했다. Distill re-ground·brief·ACQ·gate는 task마다 그대로 둔다.

## Intuition

도서관 규칙을 문 앞에서 한 번 읽고, 같은 건물 안에서는 다시 펼치지 않는다. 방마다 바뀌는 쪽지는 매번 챙긴다.

## Code

- `rules/plugin-root.md` — workflow 규칙을 세션 단위로 한 번 적재하고 같은 세션에서 재읽지 않는다.
- `skills/bouncer-run/SKILL.md` — drive 진입 시 1회 적재, task 반복 중 재적재 금지. Distill·brief·ACQ·gate는 task마다 유지.
- `test/master-rules.test.js`, `test/skill-bouncer-run.test.js` — 세션·drive 경계 구조 단언.
- `test/lightweight-cycle.test.js` — plan/execute light-path 단언을 영어 스킬 본문에 맞춤 (verify 차단 해제).

## Quiz

1. `/bouncer-run` drive에서 불변 master·product rules를 다시 읽지 않는 시점은?
   - A) Distill re-ground 직후마다
   - B) 같은 drive의 이후 task 반복
   - C) 새 workflow 세션이 시작될 때

2. 세션 단위 규칙 적재 계약이 적힌 공통 문서는?
   - A) `rules/plugin-root.md`
   - B) `rules/okf.md`
   - C) `skills/bouncer-commit/SKILL.md`

3. 반복 생략이 **적용되지 않는** 것은?
   - A) `CLAUDE.md` / governance / okf 재적재
   - B) task별 Distill re-ground와 gate
   - C) drive 진입 시 Master rules 1회 Read

## 이해 상태

- 점수: 3/3
- 정답: 1-B, 2-A, 3-B
- 응답: 1-B, 2-A, 3-B (모두 정답)
- disposition: 세션·drive 경계와 Distill/gate 유지 범위를 구분함
