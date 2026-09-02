---
type: bouncer.explain
title: 003 explain
description: Explain for 003
resource: .bouncer/context/epics/009-agent-orchestration/blueprints/005-pr-single-confirm/explain.md
tags:
  - bouncer
  - explain
timestamp: '2026-08-06T10:02:58.771+09:00'
bouncer:
  id: EXPLAIN-005
  epic_id: '009'
  blueprint_id: '005'
  status: published
  comprehension:
    diff_sha: 6d548fe11b11d18b01294dca9507472f14d1f5f263158311fd65ee3902d97369
    quiz_score: 2/2
    disposition: accepted — Q1/Q2 correct
    recorded_at: '2026-08-06T10:04:02+09:00'
---
# Explain

## Background
`/bouncer-finalize` step 4는 PR을 열지 한 번 묻고, 승인한 뒤 렌더된
title/body를 다시 확인받았다. 두 번째 질문은 같은 결정을 되묻기만 해서
마감이 끊겼다. 이번 커밋은 그 ACQ를 빼고, 승인 뒤에는 미리보기만 보여 준
다음 바로 push와 draft PR 생성으로 간다.

## Intuition
PR 승인은 한 번. 미리보기는 보여 주고, 본문·제목은 다시 묻지 않는다.

## Code
- 절차: `skills/bouncer-finalize/SKILL.md` — Gates 목록에서 `PR body confirm`
  삭제. step 4 승인 분기 = 렌더 출력 → push + `gh pr create --draft`
  (`without a further confirmation`). push/`gh` 실패 시 로컬 커밋은
  성공으로 두고 사유만 전하며 ACQ를 다시 열지 않는다.
- 문서: `docs/workflow.md` 흐름도 줄을 승인 1회·body confirm 없음으로 맞춤.
- 계약: `test/skill-bouncer-finalize.test.js`가 게이트 셋과
  `without a further confirmation|재확인하지 않는다`를 단언. 기존 PR 본문
  소스·`이해 상태` 제외 단언은 그대로다.
- 손대지 않음: `templates`/`finalize` 모듈, Commit+worktree·Next blueprint
  ACQ 문단.

## Quiz
1. step 4에서 사용자가 draft PR을 승인한 뒤 에이전트는?
   - A) 렌더된 title/body를 보여 주고 본문 확인 ACQ를 한 번 더 한다
   - B) 렌더된 title/body를 보여 준 뒤 추가 확인 없이 push와 draft PR을 만든다
   - C) 미리보기 없이 바로 `gh pr create`만 실행한다

2. `git push` 또는 `gh pr create`가 실패하면?
   - A) Draft PR ACQ를 다시 열어 본문 확인 게이트를 복구한다
   - B) 로컬 커밋을 되돌린 뒤 처음부터 다시 묻는다
   - C) 로컬 커밋 성공을 유지하고 실패 사유만 전한다 (ACQ 재요청 없음)

## 이해 상태
퀴즈 2/2. 응답 1B 2C.
정답 1B 2C.
Q1·Q2 맞음. disposition accepted.
