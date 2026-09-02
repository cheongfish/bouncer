---
type: bouncer.explain
title: 001 explain
description: Explain for 001
resource: .bouncer/context/epics/009-agent-orchestration/blueprints/003-adaptive-quiz/explain.md
tags:
  - bouncer
  - explain
timestamp: '2026-08-06T09:41:58.440+09:00'
bouncer:
  id: EXPLAIN-003
  epic_id: '009'
  blueprint_id: '003'
  status: published
  comprehension:
    diff_sha: 59aaea103f70fab062a69483df8a898b2b6eaedcb6295a5dec8bb6a1b206805e
    quiz_score: 2/2
    disposition: accepted — Q1/Q2 correct
    recorded_at: '2026-08-06T09:42:44+09:00'
---
# Explain

## Background
`explain-diff`의 `## Quiz`는 문항 수·형식이 정해져 있지 않았다. 한 줄
고친 diff와 모듈을 갈아엎은 diff가 같은 무게로 나오고, 자유 서술이라
답과 채점도 들쭉날쭉했다. 이 커밋은 스킬 산문과 그 문구를 고정하는
계약 테스트만 고친다. 채점 엔진·CLI·G15 로직은 손대지 않는다.

## Intuition
퀴즈 무게는 diff 규모가 정하고, 문항은 3지선다로 한 번에 내고 한 번에
받는다. 보기만 `## Quiz`에, 정답·응답·정오는 `## 이해 상태`에 둔다.

## Code
- 출제 규칙: `skills/explain-diff/SKILL.md` step 1·2 — 문항 수 1–10
  (최소 1), 근거 한 줄, 보기 3개, 정답 슬롯 분산, 일괄 제시·응답,
  미응답은 분모에서 제외, 미실시는 `disposition`에 사유( `0/0` 금지).
- 계약 고정: `test/skill-explain-diff.test.js`가 범위·3지선다·슬롯
  분산·섹션 분리·일괄 ACQ 문구를 개별 단언으로 잠근다.

## Quiz
1. 정답·사용자 응답·문항별 정오는 어디에 적는가?
   - A) `## Quiz`에 문항·보기와 함께
   - B) `## 이해 상태`에만
   - C) frontmatter `quiz_score`에만 (본문 불필요)

2. 사용자가 퀴즈를 건너뛰면?
   - A) `quiz_score`를 `0/0`으로 두지 말고 미실시 사유를 `disposition`에 적는다
   - B) `quiz_score`를 `0/0`으로 두고 마감을 막는다
   - C) 점수 임계값 미달로 재시험을 강제한다

## 이해 상태
퀴즈 2/2. 응답 `1-B, 2-A`. 정답 Q1=B, Q2=A. disposition accepted.
