---
type: bouncer.explain
title: BP-002 explain
description: Explain for BP-002
resource: .bouncer/context/epics/EPIC-014-numeric-context-ids/blueprints/BP-002-migrate-ids-cli/explain.md
tags:
  - bouncer
  - explain
timestamp: '2026-08-05T18:24:34.043+09:00'
bouncer:
  id: EXPLAIN-BP-002
  epic_id: EPIC-014
  blueprint_id: BP-002
  status: published
  comprehension:
    diff_sha: 505eff1660ebe13ba41394f4162fd5ffcf31591374b32c3d5c62d87ec9ce33ba
    quiz_score: 3/5
    disposition: >-
      accepted — Q1/Q4/Q5 correct; Q2 missed (hook warns only, never auto-apply);
      Q3 missed (discover must not rely on layout transition)
    recorded_at: '2026-08-05T18:26:31+09:00'
---
# Explain

## Background
BP-001이 하네스 정본을 `\d{3}`로 바꿨어도 소비자·이 레포의 디렉터리는 아직
`EPIC-`/`BP-`다. 수동 rename은 `resource`·본문 토큰·`context/index.md`·
`bouncer/current` 포인터를 놓친다. 이 커밋은 `bouncer migrate ids`로
Discover→Plan→Validate→Apply를 묶고, `migrate-ids` 스킬로 dry-run 확인 후
적용하게 하며, SessionStart가 구형 dir을 보면 그 스킬/CLI만 안내한다.
실트리 일괄 적용과 레거시 허용 제거는 BP-003이다.

## Intuition
이관은 CLI가 원자적으로 돌리고, 훅은 경고만 한다. 에이전트는 dry-run을
보여 준 뒤에만 apply한다.

## Code
- 실행기: `scripts/src/lib/migrate-ids.ts` — `discoverLegacyIds`(구형
  `EPIC-\d{3}-`/`BP-\d{3}-`만; layout 전이 허용에 기대지 않음) →
  `planMigration` → `validateMigration`(혼재·충돌·dirty) →
  `applyMigration`(bp rename → epic rename → md/`resource`/본문 rewrite →
  포인터). `rewriteLegacyTokens`는 `TASKS-BP-001`→`TASKS-001` 등을 처리.
- CLI: `cli.ts`의 `migrate ids [--dry-run]`.
- 스킬: `skills/migrate-ids/SKILL.md` — dry-run → 사용자 확인 → apply.
  generic skill 표에 넣지 않음(`graphify-runner`와 같은 선택 스킬).
- SessionStart: `hooks/session-legacy-ids.js` + `hooks.json` 두 번째 항목.
  `legacyIdsWarnings`를 stderr에 쓰고 항상 `exit 0`. `session-graph.js`와
  분리(graphify 실패·비활성에 안내가 묻히지 않게). Cursor는 SessionStart가
  없어 CLI·스킬만 씀.
- 고정: `test/migrate-ids.test.js`, `test/legacy-ids-warn.test.js`,
  `plugin-wiring` SessionStart 2항목. docs는 cli / troubleshooting /
  context-versioning.

## Quiz
1. apply 전에 반드시 거치는 검증 거절 사유 세 가지는?
2. SessionStart 훅이 migrate를 자동 실행하는가?
3. 구형 dir 탐지가 `parsePathIds`/layout 전이 허용에 의존해도 되는가? 이유는?
4. `TASKS-BP-001`은 apply 후 어떤 id가 되는가?
5. Cursor에서 구형 명명 안내는 어디서 받는가?

## 이해 상태
퀴즈 3/5. Q1·Q4·Q5 맞음. Q2는 훅이 안내만 하고 apply하지 않음. Q3은
discover가 layout 전이에 의존하면 안 됨(BP-003 이후에도 훅이 살아야 함).
disposition accepted.
