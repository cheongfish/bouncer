---
type: bouncer.explain
title: 004 explain
description: Explain for 004
resource: .bouncer/context/epics/009-agent-orchestration/blueprints/006-debugger-agent/explain.md
tags:
  - bouncer
  - explain
timestamp: '2026-08-06T10:18:18.527+09:00'
bouncer:
  id: EXPLAIN-006
  epic_id: '009'
  blueprint_id: '006'
  status: published
  comprehension:
    diff_sha: 023494a300ba8e5ad064402ef128fc07bd5905564ab1f332fbf6ea92353778bc
    quiz_score: 3/3
    disposition: accepted — Q1/Q2/Q3 correct
    recorded_at: '2026-08-06T10:19:37+09:00'
---
# Explain

## Background
verify가 깨지면 컨트롤러가 조사와 수정을 한 맥락에서 같이 했다. 증상만
보고 고치기 쉽고, 조사 과정이 리뷰 가능한 산출물로 남지 않았다.
`debugging` 스킬도 짧은 흐름뿐이라 근본원인 우선을 강제하지 못했다.
이번 커밋은 read-only `bouncer-debugger`를 두고, 4단계 debugging 절차를
행동 브리프로 쓰며, `/bouncer-execute` verify 실패 시 그 에이전트를
부르게 한다. 수정은 implementer나 컨트롤러가 한다.

## Intuition
디버거는 보고서만 쓴다. 고치는 손은 따로 있다.

## Code
- 에이전트: `agents/bouncer-debugger.md` — Hard guards(수정·커밋·상태 전환
  금지), 4단계 절차, 재디스패치 상한 3회, Output contract(재현·증거·단일
  가설·최소 수정 제안·회귀 테스트).
- 브리프: `skills/debugging/SKILL.md` — Root cause → Pattern → Hypothesis →
  Implementation. 근본원인 조사 전 수정 제안 금지. Stage 4 Gate는
  propose-or-apply이며 네임드 디버거는 제안만.
- 디스패치: `skills/bouncer-execute/SKILL.md` step 4 — verify 실패 시
  `resolveSubagentModel` → 네임드 호출 → 슬러그 거절 시 `inherit` → 네임드
  미지원 시 `debugging` 인라인 폴백. 같은 verify에 디버거 재호출은 최대 3회.
- 기본값: `config.example.json`, `scripts/src/lib/init.ts`(build로
  `scripts/lib/init.js`) — claude/cursor/codex 모두
  `bouncer-debugger: inherit`.
- 문서·계약: `docs/workflow.md`, `test/agents.test.js`,
  `test/skill-debugging.test.js`, `test/skill-bouncer-execute.test.js`,
  `test/init.test.js`, `test/subagents.test.js`.

## Quiz
1. `bouncer-debugger`가 verify 실패 조사 후 해야 할 일은?
   - A) 최소 수정을 직접 적용하고 `npm test`를 다시 돌린다
   - B) 근본원인 리포트만 반환하고 파일은 고치지 않는다
   - C) `tasks.md` 상태를 `verified`로 바꾸고 커밋한다

2. `/bouncer-execute` step 4에서 verify가 실패했을 때 디스패치 순서는?
   - A) 인라인 `debugging` → 네임드 디버거 → `inherit` 재시도
   - B) `bouncer-implementer`만 호출해 바로 고친다
   - C) `resolveSubagentModel` → 네임드 호출 → 슬러그 거절 시 `inherit` →
     네임드 미지원 시 인라인 폴백

3. 같은 verify 실패에 디버거를 몇 번까지 다시 부를 수 있나?
   - A) 최대 3회(실패 사이클) 후 아키텍처/`/bouncer-plan`으로 escalate
   - B) 성공할 때까지 제한 없음
   - C) 1회만 — 두 번째부터는 컨트롤러가 직접 고친다

## 이해 상태
퀴즈 3/3. 응답 1B 2C 3A.
정답 1B 2C 3A.
Q1·Q2·Q3 맞음. disposition accepted.
