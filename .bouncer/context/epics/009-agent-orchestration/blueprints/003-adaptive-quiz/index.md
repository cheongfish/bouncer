---
type: bouncer.blueprint
title: diff 규모에 맞춘 3지선다 이해도 퀴즈
description: explain-diff 문항 수 적응·보기 3개·정답 위치 분산·기록 위치 규정
resource: .bouncer/context/epics/009-agent-orchestration/blueprints/003-adaptive-quiz/index.md
tags:
  - bouncer
  - blueprint
timestamp: '2026-08-06T09:12:53.161+09:00'
bouncer:
  id: '003'
  epic_id: '009'
  blueprint_id: '003'
  status: approved
  commit_type: docs
  commit_intent:
    - 이해도 퀴즈 무게를 변경 규모에 맞춤
    - 답 위치가 한쪽으로 몰리지 않게 함
---
# 003 adaptive-quiz

Epic: [009](../../index.md)

## Intent
- 문제: `explain-diff`의 `## Quiz`는 문항 수·형식 규정이 없어 한 줄 고친 diff와 모듈을 갈아엎은 diff가 같은 무게로 나온다. 형식이 자유 서술이라 답하기도 채점하기도 들쭉날쭉하다.
- 완료 조건: 스킬이 diff 규모를 보고 1~10문항을 정하고, 각 문항이 보기 3개를 갖고, 정답 위치가 분산되며, 문항·보기와 정답·응답·채점의 기록 위치가 나뉜다. 015 성공 조건 1.

## Contract
- 인터페이스: `skills/explain-diff/SKILL.md` step 1·2를 고쳐 출제 규칙을 명시한다 — 문항 수는 `base..HEAD` diff 규모(변경 파일 수와 성격)를 보고 에이전트가 1~10 사이로 정하고, 그 판단 근거를 한 줄로 사용자에게 밝힌다.
- 인터페이스: 문항은 3지선다. 정답 슬롯은 문항마다 바꿔 한 위치(예: 전부 B)에 몰지 않는다.
- 인터페이스: 출제는 한 번에 제시한다 — `## Quiz`에 전 문항을 적고 사용자가 `1-A, 2-C` 형태로 한 번에 답한다. 문항마다 ACQ를 반복하지 않는다.
- 데이터·상태: `## Quiz`에는 문항과 보기 3개만 남긴다. 정답·사용자 응답·문항별 정오는 `## 이해 상태`에 적는다. `bouncer.comprehension.quiz_score`는 `N/M`이며 M은 실제 출제 수다.
- 수용 기준: 015 성공 조건 1. `test/skill-explain-diff.test.js`가 규칙 문구를 고정한다.
- 검증 명령: `npm test`
- 실패 모드·엣지 케이스: diff가 문서 전용이거나 아주 작아도 최소 1문항은 낸다. 사용자가 일부만 답하면 미응답은 오답으로 세지 말고 분모에서 빼되 `## 이해 상태`에 미응답으로 남긴다. 사용자가 퀴즈를 건너뛰면 `quiz_score`를 `0/0`으로 두지 말고 미실시 사유를 `disposition`에 적는다. 점수는 어떤 값이든 마감을 막지 않는다.

## Out of scope
- `scripts/lib/comprehension`·G15 로직 수정 — 기록 형식은 그대로다.
- 채점 자동화·퀴즈 엔진·신규 CLI.
- `skills/bouncer-finalize` 절차 변경 — 003이 맡는다.

## One-commit justification
스킬 산문 한 곳과 그 문구를 고정하는 계약 테스트뿐이라 한 커밋으로 리뷰된다.

## Documents
* [Tasks](tasks/001/tasks.md) - 구현 브리프
* [Verification](tasks/001/verification.md) - 검증 명령과 증적
* [Review](tasks/001/review.md) - 리뷰 발견사항
<!-- explain.md는 plan scaffold에 포함되지 않습니다. /bouncer-finalize가 작성합니다. -->
