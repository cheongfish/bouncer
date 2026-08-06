---
type: bouncer.explain
title: 002 explain
description: Explain for 002
resource: .bouncer/context/epics/015-workflow-ergonomics/blueprints/002-graph-basis-record/explain.md
tags:
  - bouncer
  - explain
timestamp: '2026-08-06T09:52:52.217+09:00'
bouncer:
  id: EXPLAIN-002
  epic_id: '015'
  blueprint_id: '002'
  status: published
  comprehension:
    diff_sha: e516116a1c23270a14545c563681ed828506d87c945b92c941e1d18df3f42352
    quiz_score: 2/4
    disposition: accepted — Q3/Q4 correct; Q1 missed (legacy string passes both); Q2 missed (scaffold default is [])
    recorded_at: '2026-08-06T09:55:00+09:00'
---
# Explain

## Background
`graph.basis`가 자유 문장이라 어떤 그래프를 질의했고, 왜 건너뛰었는지
도구가 읽을 수 없었다. 리뷰도 그 문장을 근거로 쓰지 못했다.
이번 커밋은 `basis`를 그래프별 엔트리 리스트로 받고, 레거시 문자열은
그대로 통과시키며, scaffold 기본값을 `[]`로 바꾼다. 기록 규칙은
`graphify-runner`가 그래프마다 엔트리를 남기도록 맞춘다.

## Intuition
근거는 문장이 아니라 행이다. 그래프마다 `status`·`query`·`result` 한 줄.

## Code
- 검증 한곳: `scripts/src/lib/validate.ts`의 `isValidGraphBasis` —
  문자열(비어 있지 않음) 또는 엔트리 배열. `GRAPH_BASIS_STATUS` 다섯 값.
  S9와 G4가 같은 헬퍼를 부른다.
- 스캐폴드: `scripts/src/lib/scaffold.ts` — 새 tasks의 `graph.basis` 기본값
  `[]`. 빈 배열은 G4에서 떨어지므로 그래프 단계를 돌아야 한다.
- 기록: `skills/graphify-runner/SKILL.md` — `built`→`updated`,
  재빌드 없음→`reused`, `failed`→`fail-skip`,
  `skip-no-graphify`/`skip-graph-disabled`→`skip-disabled`,
  `missing`→`missing`. 질의를 못 돌려도 엔트리는 남긴다.
- 문서·계약 테스트: `docs/gates.md`, `docs/ARCHITECTURE.md`,
  `test/validate-structural.test.js`, `test/validate-gates.test.js`,
  `test/skill-graphify-runner.test.js`.

## Quiz
1. 레거시 `basis: "수동으로 확인함"`(비어 있지 않은 문자열)은?
   - A) S9에서 거절
   - B) S9·G4 모두 통과
   - C) G4만 통과, S9는 거절

2. scaffold가 내는 새 tasks의 `graph.basis` 기본값은?
   - A) `[]`
   - B) `''`
   - C) `[{ graph: source, status: missing, … }]`

3. graphify가 없거나 sync가 `skip-no-graphify`일 때 runner는?
   - A) `basis`를 비우고 G4를 의도적으로 실패시킨다
   - B) 엔트리 없이 `suggested_paths`만 `[]`로 둔다
   - C) `skip-disabled`(또는 매핑된 status) 엔트리를 남긴 뒤 질의를 건너뛴다

4. `status: "stale"` 엔트리는?
   - A) 허용 — 임의 문자열
   - B) S9/G4에서 거절 — enum 밖
   - C) 경고만 하고 통과

## 이해 상태
퀴즈 2/4. 응답 1C 2B 3C 4B.
정답 1B 2A 3C 4B.
Q1 틀림(레거시 문자열은 S9·G4 통과). Q2 틀림(scaffold 기본값은 `[]`).
Q3·Q4 맞음. disposition accepted.
