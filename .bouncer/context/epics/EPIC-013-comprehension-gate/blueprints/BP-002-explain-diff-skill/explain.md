---
type: bouncer.explain
title: explain-diff로 마감 설명·퀴즈·이해 기록을 전담함
description: finalize가 explain-diff를 호출하도록 배선한 변경 설명
resource: .bouncer/context/epics/EPIC-013-comprehension-gate/blueprints/BP-002-explain-diff-skill/explain.md
tags:
  - bouncer
  - explain
timestamp: '2026-08-05T10:11:42.667+09:00'
bouncer:
  id: EXPLAIN-BP-002
  epic_id: EPIC-013
  blueprint_id: BP-002
  status: published
  comprehension:
    diff_sha: 38b1ef5f1bd04c391598a80926892ca57e5392fdda94a0c2919c0ada2426d6bd
    quiz_score: 2/5
    disposition: 'partial — path/affected_paths ok; score-gate and Distill owner unclear'
    recorded_at: '2026-08-05T10:15:21+09:00'
---
# Explain

## Background

BP-001이 `explain.md` 계약과 G15를 세웠지만, 본문·퀴즈·`bouncer.comprehension`
기록을 누가 어떻게 남기는지는 스킬에 없었다. finalize 1단계는 여전히
`spec-authoring`만 가리켜 distill 시대의 승격 안내와 explain 저술이 한곳에
섞여 있었다. 이 BP는 `skills/explain-diff/`를 신설하고 finalize가
`scaffold explain` 다음 그 스킬을 호출하게 하며, Distill 승격만
`spec-authoring`에 남긴다.

## Intuition

마감 때 “설명 쓰기 + 사람 퀴즈 + 해시 기록”은 전담 스킬(`explain-diff`)이
하고, Distill 승격은 별도(`spec-authoring`)로 둔다 — 한 스킬에 섞지 않는다.

## Code

- `skills/explain-diff/SKILL.md` — 다섯 섹션 저술, 퀴즈, `computeDiffSha`
  (`scripts/lib/comprehension`), comprehension 네 필드, `published`
- `skills/bouncer-finalize/SKILL.md` — 1단계: scaffold → explain-diff → Distill
- `skills/spec-authoring/SKILL.md` — plan 문서 + Distill 승격만 (explain 저술 제거)
- `scripts/src/lib/templates.ts` Quiz 주석 → explain-diff 안내
- 계약 테스트: `test/skill-explain-diff.test.js` 및 finalize/surface/spec-authoring

### Cycle / next-BP

- ARCHITECTURE §4 스킬 표에 `explain-diff`를 넣으려면
  `test/public-name-regression.test.js`의 `APPROVED_GENERIC_SKILLS`와 그
  테스트를 `affected_paths`에 같이 열어야 한다. 이번 커밋은 표 밖 문단으로만
  문서화했다(graphify-runner와 같은 패턴). 표 정식 편입은 후속 plan.

## Quiz

1. finalize 1단계에서 explain 본문·퀴즈·comprehension을 담당하는 스킬 경로는?
2. `quiz_score`가 낮아도 finalize 게이트를 통과할 수 있는가? 근거는?
3. `diff_sha`는 어떤 모듈/함수로 채우며, `ok: false`면 어떻게 해야 하는가?
4. Distill 승격은 이 BP에서 어느 스킬이 맡는가?
5. ARCHITECTURE §4 표에 `explain-diff`를 못 넣은 직접 이유는?

## 이해 상태

- 점수: **2/5**
- 정답: (1) `skills/explain-diff/SKILL.md` / explain-diff — OK  
  (5) `public-name-regression` 등이 `affected_paths`에 없어 표를 못 바꿈 — OK
- 오답·공백: (2) 낮은 점수도 **기록만 하면 게이트를 막지 않는다** (부가사항이 아님)  
  (3) `scripts/lib/comprehension`의 `computeDiffSha`; `ok: false`면 해시 꾸며 넣지
  말고 중단  
  (4) Distill 승격은 이 BP에서 `spec-authoring`
- disposition: partial — path/affected_paths ok; score-gate and Distill owner unclear
