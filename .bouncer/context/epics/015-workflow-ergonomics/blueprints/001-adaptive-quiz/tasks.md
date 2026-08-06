---
type: bouncer.tasks
title: explain-diff 퀴즈를 diff 규모에 맞춘 3지선다로 규정함
description: 문항 수 적응·보기 3개·정답 위치 분산·기록 위치 분리
resource: .bouncer/context/epics/015-workflow-ergonomics/blueprints/001-adaptive-quiz/tasks.md
tags:
  - bouncer
  - tasks
timestamp: '2026-08-06T09:12:53.161+09:00'
bouncer:
  id: TASKS-001
  epic_id: '015'
  blueprint_id: '001'
  status: ready
  affected_paths:
    - skills/explain-diff/SKILL.md
    - test/skill-explain-diff.test.js
  graph:
    generated_at: '2026-08-06T09:31:32+09:00'
    command: graphify query (source + context graphs)
    suggested_paths:
      - test
      - skills/explain-diff
    basis: 'graph-sync rebuilt the context graph (built: context; source already fresh; failed: none). Source query "explain-diff quiz comprehension diff_sha skill contract test" returned test/skill-explain-diff.test.js, test/comprehension.test.js, test/master-rules.test.js. Context query on the same string returned the 013-comprehension-gate explain docs, confirming this is the same surface that blueprint established. skills/explain-diff was added by hand because config.source_dirs is scripts/hooks/test and never returns skill paths. comprehension.test.js is deliberately excluded from affected_paths — this blueprint changes skill prose only.'
---
# Tasks

Blueprint: [001](index.md)

## Goal & intent
`explain-diff`가 이해도 퀴즈를 변경 규모에 맞춰 낸다. 문항 수는 `base..HEAD` diff를
보고 1~10 사이에서 정하고, 각 문항은 보기 3개, 정답 위치는 문항마다 흩어 놓는다.
문항과 보기는 `## Quiz`에, 정답·사용자 응답·정오는 `## 이해 상태`에 남긴다.
점수는 여전히 마감을 막지 않는다. 검증은 `npm test`.

## Interface
- 제공: `skills/explain-diff/SKILL.md` step 1·2에 출제 규칙 — 문항 수 1~10 적응,
  3지선다, 정답 슬롯 분산, 한 번에 제시·한 번에 응답.
- 제공: 기록 위치 분리 — `## Quiz`는 문항+보기, `## 이해 상태`는 정답·응답·정오.
- 거부: 문항마다 ACQ를 반복하는 진행, 정답을 `## Quiz`에 함께 적는 것,
  점수 임계값·재시험 강제, 0문항 출제.

## Touch
- Modify `skills/explain-diff/SKILL.md` — step 1의 `## Quiz`·`## 이해 상태` 설명과
  step 2 퀴즈 진행 절차를 위 규칙으로 다시 쓴다. Guardrails에 "채점 엔진·CLI를
  만들지 않는다"는 기존 문장을 유지한다.
- Modify `test/skill-explain-diff.test.js` — 문항 수 범위·3지선다·정답 분산·
  기록 위치 분리 문구를 개별 단언으로 고정한다.

## Do not touch
- `scripts/src/lib/comprehension.ts`·`scripts/lib/comprehension.js` — 기록 형식과
  `computeDiffSha`는 그대로다.
- `scripts/src/lib/validate.ts` G15 — 게이트 판정은 바뀌지 않는다.
- `skills/bouncer-finalize/SKILL.md` — 003이 같은 파일을 고친다.
- `test/comprehension.test.js`·`test/validate-gates.test.js` — 로직 미변경.

## Constraints
- 스킬 산문만 바꾼다. 코드·게이트·CLI 추가 금지.
- 문항 수는 결정적 표가 아니라 에이전트 판단이되, 범위(1~10)와 근거를 한 줄로
  밝히는 의무를 문서에 남긴다.
- "정답 위치 랜덤"은 난수원 없이 지킬 수 있는 문장으로 쓴다 — 문항마다 슬롯을
  바꾸고 한 위치에 몰지 않는다는 규칙으로 표현하고, 난수 함수를 요구하지 않는다.
- 기존 계약 문구(비차단 점수, `scaffold explain` 선행, Korean, `stop-slop`,
  `computeDiffSha`)를 지우지 않는다 — 현행 테스트가 그대로 통과해야 한다.
- 스킬 본문은 영어를 유지한다(다른 워크플로 스킬과 동일). 사용자에게 보이는
  한국어 문구는 기존처럼 인용 형태로만 둔다.

## Checklist
- [ ] `test/skill-explain-diff.test.js`에 아래 단언을 먼저 추가하고 실패를 확인한다.
  ```js
  assert.match(md, /1[–~-]10/);           // 문항 수 범위
  assert.match(md, /three (answer )?options|3지선다/);
  assert.match(md, /vary the correct-answer position|한 위치에 몰지/);
  ```
- [ ] `## Quiz`에는 문항+보기만, 정답·응답·정오는 `## 이해 상태`에 적는다는
  단언을 추가한다(두 섹션 이름을 각각 포함하는 문장 단위로).
- [ ] 문항마다 ACQ를 반복하지 않고 한 번에 제시·응답한다는 단언을 추가한다.
- [ ] `skills/explain-diff/SKILL.md` step 1의 `## Quiz` / `## 이해 상태` 항목
  설명을 새 규칙으로 교체한다.
- [ ] step 2를 "규모 판단 → 근거 한 줄 고지 → 전 문항 제시 → 한 번에 응답 수집 →
  채점 → `## 이해 상태` 기록" 순서로 다시 쓴다. `quiz_score`의 M이 실제 출제
  수이고 미응답은 분모에서 뺀다는 점을 명시한다.
- [ ] 최소 1문항 하한과, 퀴즈 미실시 시 `disposition`에 사유를 적는다는 처리를
  넣는다.
- [ ] 기존 단언이 모두 살아 있는지 확인한 뒤 `npm test` 통과.
