---
type: bouncer.blueprint
title: draft PR 승인 뒤 재확인 없이 바로 생성
description: finalize step 4의 PR 본문 확인 ACQ 제거와 미리보기 출력 유지
resource: .bouncer/context/epics/009-agent-orchestration/blueprints/005-pr-single-confirm/index.md
tags:
  - bouncer
  - blueprint
timestamp: '2026-08-06T09:12:53.161+09:00'
bouncer:
  id: '005'
  epic_id: '009'
  blueprint_id: '005'
  status: approved
  commit_type: docs
  commit_intent:
    - 같은 결정을 두 번 묻지 않게 함
    - 승인 이후 마감 흐름이 끊기지 않게 함
---
# 005 pr-single-confirm

Epic: [009](../../index.md)

## Intent
- 문제: `/bouncer-finalize` step 4가 PR을 열지 묻고, 승인한 뒤 본문을 다시 확인받는다. 두 번째 질문은 같은 결정을 되묻는 것이라 마감 흐름만 끊는다.
- 완료 조건: PR 여부 ACQ 하나만 남고, 승인 뒤에는 렌더된 title/body를 출력한 다음 확인 없이 push와 `gh pr create`까지 간다. 015 성공 조건 4.

## Contract
- 인터페이스: `skills/bouncer-finalize/SKILL.md` step 4에서 "second ACQ"(본문 확인) 절차를 없앤다. 승인 분기는 "렌더된 title + body 출력 → push → draft PR 생성"으로 이어진다.
- 인터페이스: 상단 ACQ 목록에서 `PR body confirm` 항목을 뺀다. 남는 게이트는 Commit+worktree(step 3) · PR(step 4) · Next blueprint(step 6) 셋이다.
- 데이터·상태: PR 본문 소스(`explain.md`의 `## Background`/`## Intuition`/`## Code`), 제목 규칙(`[YYMMDD] (→ MergeTarget) [Type] 요약`), `## 이해 상태`·Quiz 제외 규칙은 그대로다.
- 수용 기준: 015 성공 조건 4. `test/skill-bouncer-finalize.test.js`가 남은 ACQ 셋과 본문 재확인 부재를 고정한다.
- 검증 명령: `npm test`
- 실패 모드·엣지 케이스: remote나 `gh`가 없으면 기존대로 graceful skip이며 PR ACQ 자체를 생략하고 안내만 한다. 사용자가 PR을 거절하면 step 5로 간다. 승인 뒤 `gh pr create`가 실패하면 로컬 커밋은 성공으로 보고하고 실패 사유를 그대로 전한다 — 실패를 승인 재요청으로 바꾸지 않는다.

## Out of scope
- Commit+worktree ACQ(step 3)와 Next blueprint ACQ(step 6) 완화.
- PR 템플릿(`scripts/lib/templates.js` `PR_TEMPLATE`) 내용 변경.
- PR 자동 머지·리뷰어 지정·라벨 규칙 변경.
- 커밋 메시지 생성 규칙.

## One-commit justification
스킬 산문 한 곳과 그 절차를 고정하는 계약 테스트, 그리고 흐름도 한 줄뿐이다.

## Documents
* [Tasks](tasks/001/tasks.md) - 구현 브리프
* [Verification](tasks/001/verification.md) - 검증 명령과 증적
* [Review](tasks/001/review.md) - 리뷰 발견사항
<!-- explain.md는 plan scaffold에 포함되지 않습니다. /bouncer-finalize가 작성합니다. -->
